import type { Item, Key } from "./store.ts";

/**
 * The model tables as the functions write them: their keys, their indexes' names, and the attributes Amplify's own
 * resolvers expect on every row (`__typename`, `createdAt`, `updatedAt`), because the admin views read these rows
 * through the generated queries. The schema is amplify/areas/*\/schema.ts; the index names here are the `.name()`
 * each index is given there, and a test holds the two together.
 */

export const models = ["Person", "PersonEmail", "Activity", "Submission", "Invitation", "AccessGrant"] as const;
export type Model = (typeof models)[number];

/** Each model's key attributes, for the in-memory store. */
export const modelKeys: Record<Model, string[]> = {
  Person: ["id"],
  PersonEmail: ["email"],
  Activity: ["id"],
  Submission: ["id"],
  Invitation: ["email"],
  AccessGrant: ["id"],
};

/** Each index: its model, its name, its partition key and its sort key. */
export const indexes = {
  personBySub: { model: "Person", name: "bySub", partition: "cognitoSub" },
  activityByPerson: { model: "Activity", name: "byPerson", partition: "personId", sort: "at" },
  activityBySubject: { model: "Activity", name: "bySubject", partition: "subjectId", sort: "at" },
  activityByArea: { model: "Activity", name: "byArea", partition: "area", sort: "at" },
  submissionByStatus: { model: "Submission", name: "byStatus", partition: "status", sort: "receivedAt" },
  submissionByEmail: { model: "Submission", name: "byEmail", partition: "email", sort: "receivedAt" },
  submissionByPerson: { model: "Submission", name: "byPerson", partition: "personId", sort: "receivedAt" },
  invitationByStatus: { model: "Invitation", name: "byStatus", partition: "status", sort: "statusAt" },
  invitationBySub: { model: "Invitation", name: "byCognitoSub", partition: "cognitoSub" },
  grantByPerson: { model: "AccessGrant", name: "byPerson", partition: "personId", sort: "resource" },
  grantByResource: { model: "AccessGrant", name: "byResource", partition: "resource", sort: "grantedAt" },
} as const satisfies Record<string, { model: Model; name: string; partition: string; sort?: string }>;

/** A new row of `model`, with the attributes Amplify's resolvers expect. */
export const row = (model: Model, fields: Item, now: Date): Item => {
  const at = now.toISOString();
  const item: Item = { __typename: model, createdAt: at, updatedAt: at };
  for (const [name, value] of Object.entries(fields)) if (value !== undefined) item[name] = value;
  return item;
};

/** The `set` of an update, with `updatedAt` and without undefined values. */
export const changes = (fields: Item, now: Date): Item => {
  const set: Item = { updatedAt: now.toISOString() };
  for (const [name, value] of Object.entries(fields)) if (value !== undefined) set[name] = value;
  return set;
};

export const emailKey = (email: string): Key => ({ email });
export const idKey = (id: string): Key => ({ id });
