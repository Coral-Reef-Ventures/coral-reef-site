import {
  type Cond,
  ConditionFailed,
  holds,
  type Item,
  type Key,
  type Query,
  type Store,
  type Write,
} from "../functions/shared/store.ts";

/**
 * The store in memory, for the functions' tests. Each table is a map from its key's JSON to an item; an index is any
 * attribute named in a query, which is enough because every index here has one partition and at most one sort key.
 * Conditions are evaluated with the same `holds` the real store's expressions are written from.
 */
export type MemoryStore = Store & {
  tables: Map<string, Map<string, Item>>;
  /** Every item of a table, for assertions. */
  all(table: string): Item[];
  /** Makes the next call of `method` throw, as an unreadable table would. */
  failNext(method: "get" | "query" | "write" | "transact", error?: Error): void;
};

const keyOf = (key: Key) => JSON.stringify(Object.entries(key).sort(([a], [b]) => a.localeCompare(b)));

export const memoryStore = (keys: Record<string, string[]>): MemoryStore => {
  const tables = new Map<string, Map<string, Item>>();
  const failures = new Map<string, Error>();
  const table = (name: string) => {
    let found = tables.get(name);
    if (!found) {
      found = new Map();
      tables.set(name, found);
    }
    return found;
  };
  const keyFields = (name: string) => keys[name] ?? ["id"];
  const keyFromItem = (name: string, item: Item): Key =>
    Object.fromEntries(keyFields(name).map((field) => [field, String(item[field])]));
  const trip = (method: string) => {
    const error = failures.get(method);
    if (error) {
      failures.delete(method);
      throw error;
    }
  };

  const check = (write: Write) => {
    const { name, key, when } =
      "put" in write
        ? { name: write.put.table, key: keyFromItem(write.put.table, write.put.item), when: write.put.when }
        : "update" in write
          ? { name: write.update.table, key: write.update.key, when: write.update.when }
          : { name: write.delete.table, key: write.delete.key, when: write.delete.when };
    if (when && !holds(when, table(name).get(keyOf(key)))) throw new ConditionFailed();
  };
  const apply = (write: Write) => {
    if ("put" in write) {
      table(write.put.table).set(keyOf(keyFromItem(write.put.table, write.put.item)), structuredClone(write.put.item));
    } else if ("update" in write) {
      const { table: name, key, set = {}, append = {}, remove = [] } = write.update;
      const current: Item = { ...(table(name).get(keyOf(key)) ?? key), ...structuredClone(set) };
      for (const [field, values] of Object.entries(append)) {
        const list = Array.isArray(current[field]) ? (current[field] as unknown[]) : [];
        current[field] = [...list, ...structuredClone(values)];
      }
      for (const field of remove) delete current[field];
      table(name).set(keyOf(key), current);
    } else {
      table(write.delete.table).delete(keyOf(write.delete.key));
    }
  };

  return {
    tables,
    all: (name) => [...table(name).values()].map((item) => structuredClone(item)),
    failNext: (method, error = new Error("table unreadable")) => {
      failures.set(method, error);
    },
    async get(name, key) {
      trip("get");
      const item = table(name).get(keyOf(key));
      return item && structuredClone(item);
    },
    async query(query: Query) {
      trip("query");
      const [field, value] = query.partition;
      let items = [...table(query.table).values()].filter((item) => item[field] === value);
      if (query.sort) {
        const sortName = query.sort.name;
        items = items.filter((item) => item[sortName] !== undefined);
        if (query.sort.below !== undefined) {
          const below = query.sort.below;
          items = items.filter((item) => String(item[sortName]) < below);
        }
        items.sort((a, b) => String(a[sortName]).localeCompare(String(b[sortName])));
        if (query.descending) items.reverse();
      }
      return items.slice(0, query.limit ?? items.length).map((item) => structuredClone(item));
    },
    async write(write) {
      trip("write");
      check(write);
      apply(write);
    },
    async transact(writes) {
      trip("transact");
      for (const write of writes) check(write);
      for (const write of writes) apply(write);
    },
    async add(name, key, field, by, when?: Cond, set = {}) {
      const current = table(name).get(keyOf(key));
      if (when && !holds(when, current)) throw new ConditionFailed();
      const next = Number(current?.[field] ?? 0) + by;
      table(name).set(keyOf(key), { ...(current ?? key), ...set, [field]: next });
      return next;
    },
  };
};
