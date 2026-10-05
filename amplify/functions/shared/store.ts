/**
 * The narrow slice of DynamoDB the functions use, so every operation runs the same way against the real tables
 * (dynamo-store.ts) and against the in-memory store the tests use (amplify/test/memory-store.ts). Conditions are data
 * rather than expression strings, so the in-memory store evaluates exactly what the real one sends.
 *
 * Tables are named by model ("Person", "Invitation", ...) and mapped to physical names by the real store.
 */

export type Scalar = string | number | boolean;
export type Item = Record<string, unknown>;
export type Key = Record<string, string>;

/** A condition on the item a write meets, with attribute_exists semantics for a missing item. */
export type Cond =
  | { exists: string }
  | { notExists: string }
  | { eq: [string, Scalar] }
  | { lt: [string, number] }
  | { and: Cond[] }
  | { or: Cond[] };

export type Put = { table: string; item: Item; when?: Cond };
export type Update = {
  table: string;
  key: Key;
  set?: Record<string, unknown>;
  /** Adds values to the end of a list attribute, creating it if absent, atomically: two appends at once keep both. */
  append?: Record<string, unknown[]>;
  remove?: string[];
  when?: Cond;
};
export type Delete = { table: string; key: Key; when?: Cond };
export type Write = { put: Put } | { update: Update } | { delete: Delete };

/** A query on a table's partition key or on an index's: equality on the partition, optionally below a sort key value. */
export type Query = {
  table: string;
  index?: string;
  partition: [string, string];
  sort?: { name: string; below?: string };
  limit?: number;
  /** Newest first when the sort key is a time. */
  descending?: boolean;
};

/** A write whose condition did not hold, or a transaction one of whose conditions did not. */
export class ConditionFailed extends Error {
  constructor(message = "condition failed") {
    super(message);
    this.name = "ConditionFailed";
  }
}

export type Store = {
  get(table: string, key: Key): Promise<Item | undefined>;
  /** Every match, following pages, unless `limit` says fewer. */
  query(query: Query): Promise<Item[]>;
  write(write: Write): Promise<void>;
  /** All or nothing, at most 100 writes. */
  transact(writes: Write[]): Promise<void>;
  /** Adds `by` to a number attribute, creating the item if it is absent, and returns the new value. */
  add(table: string, key: Key, field: string, by: number, when?: Cond, set?: Record<string, unknown>): Promise<number>;
};

/** Whether `cond` holds for `item` (undefined when there is none). The in-memory store's evaluator, exported for it. */
export const holds = (cond: Cond, item: Item | undefined): boolean => {
  if ("and" in cond) return cond.and.every((c) => holds(c, item));
  if ("or" in cond) return cond.or.some((c) => holds(c, item));
  if ("exists" in cond) return item?.[cond.exists] !== undefined;
  if ("notExists" in cond) return item?.[cond.notExists] === undefined;
  if ("eq" in cond) return item !== undefined && item[cond.eq[0]] === cond.eq[1];
  const value = item?.[cond.lt[0]];
  return typeof value === "number" && value < cond.lt[1];
};
