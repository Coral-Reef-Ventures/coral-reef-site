import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { type Cond, ConditionFailed, type Item, type Key, type Query, type Store, type Write } from "./store.ts";

/** The document client's one method the store uses, so a test can hand in a recorder. */
export type Sender = { send(command: unknown): Promise<unknown> };

/** Expression names and values for one command, numbered as they are added. */
class Expression {
  names: Record<string, string> = {};
  values: Record<string, unknown> = {};
  #n = 0;
  name(attribute: string): string {
    const found = Object.entries(this.names).find(([, value]) => value === attribute)?.[0];
    if (found) return found;
    const placeholder = `#n${this.#n++}`;
    this.names[placeholder] = attribute;
    return placeholder;
  }
  value(value: unknown): string {
    const placeholder = `:v${this.#n++}`;
    this.values[placeholder] = value;
    return placeholder;
  }
  condition(cond: Cond): string {
    if ("and" in cond) return cond.and.map((c) => `(${this.condition(c)})`).join(" AND ");
    if ("or" in cond) return cond.or.map((c) => `(${this.condition(c)})`).join(" OR ");
    if ("exists" in cond) return `attribute_exists(${this.name(cond.exists)})`;
    if ("notExists" in cond) return `attribute_not_exists(${this.name(cond.notExists)})`;
    if ("eq" in cond) return `${this.name(cond.eq[0])} = ${this.value(cond.eq[1])}`;
    return `${this.name(cond.lt[0])} < ${this.value(cond.lt[1])}`;
  }
  /** Names and values, leaving out an empty map, which DynamoDB refuses. */
  attributes() {
    return {
      ...(Object.keys(this.names).length ? { ExpressionAttributeNames: this.names } : {}),
      ...(Object.keys(this.values).length ? { ExpressionAttributeValues: this.values } : {}),
    };
  }
}

/** The input of a Put, Update or Delete, as a single command and as a transaction entry both take it. */
export const writeInput = (write: Write, tableName: (model: string) => string) => {
  const e = new Expression();
  if ("put" in write) {
    const { table, item, when } = write.put;
    const condition = when ? e.condition(when) : undefined;
    return {
      kind: "Put" as const,
      input: {
        TableName: tableName(table),
        Item: item,
        ...(condition ? { ConditionExpression: condition } : {}),
        ...e.attributes(),
      },
    };
  }
  if ("update" in write) {
    const { table, key, set = {}, append = {}, remove = [], when } = write.update;
    const parts: string[] = [];
    const sets = Object.entries(set).map(([name, value]) => `${e.name(name)} = ${e.value(value)}`);
    for (const [name, values] of Object.entries(append)) {
      const n = e.name(name);
      sets.push(`${n} = list_append(if_not_exists(${n}, ${e.value([])}), ${e.value(values)})`);
    }
    if (sets.length) parts.push(`SET ${sets.join(", ")}`);
    if (remove.length) parts.push(`REMOVE ${remove.map((name) => e.name(name)).join(", ")}`);
    const condition = when ? e.condition(when) : undefined;
    return {
      kind: "Update" as const,
      input: {
        TableName: tableName(table),
        Key: key,
        UpdateExpression: parts.join(" "),
        ...(condition ? { ConditionExpression: condition } : {}),
        ...e.attributes(),
      },
    };
  }
  const { table, key, when } = write.delete;
  const condition = when ? e.condition(when) : undefined;
  return {
    kind: "Delete" as const,
    input: {
      TableName: tableName(table),
      Key: key,
      ...(condition ? { ConditionExpression: condition } : {}),
      ...e.attributes(),
    },
  };
};

const failed = (error: unknown): boolean =>
  error instanceof ConditionalCheckFailedException ||
  error instanceof TransactionCanceledException ||
  (error instanceof Error && ["ConditionalCheckFailedException", "TransactionCanceledException"].includes(error.name));

/** The store on DynamoDB. `tables` maps each model to its table's physical name. */
export const dynamoStore = (
  tables: Record<string, string>,
  sender: Sender = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
): Store => {
  const tableName = (model: string): string => {
    const name = tables[model];
    if (!name) throw new Error(`No table is configured for ${model}`);
    return name;
  };
  const guard = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (failed(error)) throw new ConditionFailed();
      throw error;
    }
  };
  return {
    async get(table: string, key: Key) {
      // Strongly consistent, as the Store promises (store.ts); DynamoDB's default is eventually consistent.
      const result = (await sender.send(
        new GetCommand({ TableName: tableName(table), Key: key, ConsistentRead: true }),
      )) as { Item?: Item };
      return result.Item;
    },
    async query(query: Query) {
      const e = new Expression();
      let condition = `${e.name(query.partition[0])} = ${e.value(query.partition[1])}`;
      if (query.sort?.below !== undefined)
        condition += ` AND ${e.name(query.sort.name)} < ${e.value(query.sort.below)}`;
      const items: Item[] = [];
      let start: Record<string, unknown> | undefined;
      do {
        const page = (await sender.send(
          new QueryCommand({
            TableName: tableName(query.table),
            ...(query.index ? { IndexName: query.index } : {}),
            KeyConditionExpression: condition,
            ...e.attributes(),
            ScanIndexForward: !query.descending,
            ...(query.limit ? { Limit: query.limit - items.length } : {}),
            ...(start ? { ExclusiveStartKey: start } : {}),
          }),
        )) as { Items?: Item[]; LastEvaluatedKey?: Record<string, unknown> };
        items.push(...(page.Items ?? []));
        start = page.LastEvaluatedKey;
      } while (start && (!query.limit || items.length < query.limit));
      return items;
    },
    write: (write: Write) =>
      guard(async () => {
        const { kind, input } = writeInput(write, tableName);
        if (kind === "Put") await sender.send(new PutCommand(input as never));
        else if (kind === "Update") await sender.send(new UpdateCommand(input as never));
        else await sender.send(new DeleteCommand(input as never));
      }),
    transact: (writes: Write[]) =>
      guard(async () => {
        if (writes.length === 0) return;
        if (writes.length > 100) throw new Error("A transaction holds at most 100 writes");
        const items = writes.map((write) => {
          const { kind, input } = writeInput(write, tableName);
          return { [kind]: input };
        });
        await sender.send(new TransactWriteCommand({ TransactItems: items as never }));
      }),
    add: (table, key, field, by, when, set = {}) =>
      guard(async () => {
        const e = new Expression();
        const sets = Object.entries(set).map(([name, value]) => `${e.name(name)} = ${e.value(value)}`);
        const expression = `ADD ${e.name(field)} ${e.value(by)}${sets.length ? ` SET ${sets.join(", ")}` : ""}`;
        const condition = when ? e.condition(when) : undefined;
        const result = (await sender.send(
          new UpdateCommand({
            TableName: tableName(table),
            Key: key,
            UpdateExpression: expression,
            ...(condition ? { ConditionExpression: condition } : {}),
            ...e.attributes(),
            ReturnValues: "UPDATED_NEW",
          }),
        )) as { Attributes?: Item };
        return Number(result.Attributes?.[field] ?? 0);
      }),
  };
};
