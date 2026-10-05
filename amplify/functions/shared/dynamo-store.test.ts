import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { describe, expect, it } from "vitest";

import { memoryStore } from "../../test/memory-store.ts";
import { dynamoStore, writeInput } from "./dynamo-store.ts";
import { ulid, isUlid } from "./ids.ts";
import { ConditionFailed, holds } from "./store.ts";

const name = (model: string) => `${model}-api-NONE`;

describe("the DynamoDB store", () => {
  it("writes a condition as the expression DynamoDB evaluates", () => {
    const { kind, input } = writeInput(
      {
        update: {
          table: "Invitation",
          key: { email: "a@b.co" },
          set: { status: "accepted", cognitoSub: "s" },
          remove: ["revokedAt"],
          when: { and: [{ eq: ["status", "pending"] }, { notExists: "cognitoSub" }] },
        },
      },
      name,
    );
    expect(kind).toBe("Update");
    expect(input).toEqual({
      TableName: "Invitation-api-NONE",
      Key: { email: "a@b.co" },
      UpdateExpression: "SET #n0 = :v1, #n2 = :v3 REMOVE #n4",
      ConditionExpression: "(#n0 = :v5) AND (attribute_not_exists(#n2))",
      ExpressionAttributeNames: { "#n0": "status", "#n2": "cognitoSub", "#n4": "revokedAt" },
      ExpressionAttributeValues: { ":v1": "accepted", ":v3": "s", ":v5": "pending" },
    });
  });

  it("appends to a list with list_append, creating it if absent, beside the other sets", () => {
    const { input } = writeInput(
      {
        update: {
          table: "Invitation",
          key: { email: "a@b.co" },
          set: { updatedAt: "t" },
          append: { admittedUsernames: ["Google_1"] },
        },
      },
      name,
    );
    expect(input).toMatchObject({
      UpdateExpression: "SET #n0 = :v1, #n2 = list_append(if_not_exists(#n2, :v3), :v4)",
      ExpressionAttributeNames: { "#n0": "updatedAt", "#n2": "admittedUsernames" },
      ExpressionAttributeValues: { ":v1": "t", ":v3": [], ":v4": ["Google_1"] },
    });
  });

  it("writes or, exists and lt, and leaves out empty attribute maps", () => {
    const put = writeInput(
      { put: { table: "T", item: { pk: "x" }, when: { or: [{ exists: "pk" }, { lt: ["n", 3] }] } } },
      name,
    );
    expect(put.input).toMatchObject({ ConditionExpression: "(attribute_exists(#n0)) OR (#n1 < :v2)" });
    const plain = writeInput({ delete: { table: "T", key: { pk: "x" } } }, name);
    expect(plain.input).toEqual({ TableName: "T-api-NONE", Key: { pk: "x" } });
  });

  it("turns DynamoDB's conditional failures into ConditionFailed, and passes other errors on", async () => {
    const failing = (error: Error) => dynamoStore({ T: "t" }, { send: async () => Promise.reject(error) });
    const conditional = new ConditionalCheckFailedException({ message: "no", $metadata: {} });
    await expect(failing(conditional).write({ delete: { table: "T", key: { pk: "x" } } })).rejects.toBeInstanceOf(
      ConditionFailed,
    );
    const canceled = Object.assign(new Error("canceled"), { name: "TransactionCanceledException" });
    await expect(failing(canceled).transact([{ delete: { table: "T", key: { pk: "x" } } }])).rejects.toBeInstanceOf(
      ConditionFailed,
    );
    await expect(failing(new Error("throttled")).write({ delete: { table: "T", key: { pk: "x" } } })).rejects.toThrow(
      "throttled",
    );
    await expect(dynamoStore({}).get("Nope", { id: "x" })).rejects.toThrow(/No table/);
  });

  it("follows a query's pages and stops at its limit", async () => {
    const pages = [
      { Items: [{ id: 1 }, { id: 2 }], LastEvaluatedKey: { id: 2 } },
      { Items: [{ id: 3 }], LastEvaluatedKey: undefined },
    ];
    const sent: unknown[] = [];
    const store = dynamoStore(
      { T: "t" },
      {
        send: async (command) => {
          sent.push(command);
          return pages.shift();
        },
      },
    );
    expect(
      await store.query({ table: "T", index: "byX", partition: ["x", "1"], sort: { name: "at", below: "z" } }),
    ).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(sent).toHaveLength(2);
    expect((sent[0] as { input: Record<string, unknown> }).input).toMatchObject({
      IndexName: "byX",
      KeyConditionExpression: "#n0 = :v1 AND #n2 < :v3",
    });
  });
});

describe("conditions, as the in-memory store evaluates them", () => {
  it("treat a missing item as having no attributes", () => {
    expect(holds({ notExists: "email" }, undefined)).toBe(true);
    expect(holds({ exists: "email" }, undefined)).toBe(false);
    expect(holds({ eq: ["status", "pending"] }, undefined)).toBe(false);
    expect(holds({ or: [{ notExists: "n" }, { lt: ["n", 3] }] }, { n: 2 })).toBe(true);
    expect(holds({ or: [{ notExists: "n" }, { lt: ["n", 3] }] }, { n: 3 })).toBe(false);
  });

  it("make a failed transaction write nothing", async () => {
    const store = memoryStore({ T: ["pk"] });
    await store.write({ put: { table: "T", item: { pk: "a" } } });
    await expect(
      store.transact([
        { put: { table: "T", item: { pk: "b" } } },
        { put: { table: "T", item: { pk: "a" }, when: { notExists: "pk" } } },
      ]),
    ).rejects.toBeInstanceOf(ConditionFailed);
    expect(store.all("T")).toEqual([{ pk: "a" }]);
  });
});

describe("ulid", () => {
  it("is 26 Crockford characters that sort by time", () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_001);
    expect(isUlid(a)).toBe(true);
    expect(a < b).toBe(true);
    expect(ulid(0, new Uint8Array(10))).toBe("0".repeat(26));
  });
});
