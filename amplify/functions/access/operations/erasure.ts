import { indexes } from "../../shared/models.ts";
import { ConditionFailed, type Item } from "../../shared/store.ts";
import type { Caller } from "../caller.ts";
import { activity, type Deps, Refusal } from "../context.ts";
import { admittedUsernames } from "./admission.ts";
import { actorId, grantsOf, normalEmail } from "./common.ts";

/**
 * Erasure (plan §2.3, §2.3a). deletePerson removes a Person and everything that names them: every Submission sent from
 * their address or invited from for them, with its Activity, and their Cognito user. eraseEmail is for anyone whose
 * address was submitted, by them or by someone else. The record of an erasure, `people.deleted`, holds ids only and
 * names no Person, so it is not itself erased.
 */

const queryAll = (deps: Deps, index: (typeof indexes)[keyof typeof indexes], value: string) =>
  deps.store.query({
    table: index.model,
    index: index.name,
    partition: [index.partition, value],
    ...("sort" in index ? { sort: { name: index.sort } } : {}),
  });

/** Each Submission found, once, with its Activity. Returns how many submissions went. */
const eraseFound = async (deps: Deps, found: Item[][]): Promise<number> => {
  const ids = new Set(found.flat().map((submission) => String(submission.id)));
  for (const id of ids) {
    for (const item of await queryAll(deps, indexes.activityBySubject, id)) {
      await deps.store.write({ delete: { table: "Activity", key: { id: String(item.id) } } });
    }
    await deps.store.write({ delete: { table: "Submission", key: { id } } });
  }
  return ids.size;
};

/** Every Submission from an address, and each one's Activity. */
const eraseSubmissions = async (deps: Deps, email: string): Promise<number> =>
  eraseFound(deps, [await queryAll(deps, indexes.submissionByEmail, email)]);

/**
 * A Person's submissions: those sent from their address, and every one an admin invited them from, which names them by
 * `personId` whatever address sent it. The address alone misses an invitation sent to an address other than the one
 * that wrote in, and one rebindInvitation has since moved; invite takes the submission's `expiresAt` away, so nothing
 * else would ever delete either.
 */
const erasePersonSubmissions = async (deps: Deps, personId: string, email: string): Promise<number> =>
  eraseFound(deps, [
    await queryAll(deps, indexes.submissionByEmail, email),
    await queryAll(deps, indexes.submissionByPerson, personId),
  ]);

/**
 * Every Cognito user the app created for an invitation or a person: the bound one, and each one pre sign-up admitted for
 * the address, which includes any that never bound. Each is deleted; one already gone needs nothing.
 */
const removeUsers = async (deps: Deps, ...sources: (Item | undefined)[]) => {
  const usernames = new Set<string>();
  for (const source of sources) {
    if (typeof source?.cognitoUsername === "string" && source.cognitoUsername) usernames.add(source.cognitoUsername);
    for (const name of admittedUsernames(source)) usernames.add(name);
  }
  for (const username of usernames) await deps.directory.remove(username);
};

const erasePerson = async (deps: Deps, personId: string): Promise<{ found: boolean; submissions: number }> => {
  const person = await deps.store.get("Person", { id: personId });
  if (!person) return { found: false, submissions: 0 };
  const email = String(person.email);
  const invitation = await deps.store.get("Invitation", { email });
  const ownInvitation = invitation?.personId === personId ? invitation : undefined;
  // The Cognito users first: the rows below are the only record of their usernames, so a failure here must leave them.
  await removeUsers(deps, ownInvitation, person);

  for (const item of await queryAll(deps, indexes.activityByPerson, personId)) {
    await deps.store.write({ delete: { table: "Activity", key: { id: String(item.id) } } });
  }
  for (const grant of await grantsOf(deps, personId)) {
    await deps.store.write({ delete: { table: "AccessGrant", key: { id: String(grant.id) } } });
  }
  const submissions = await erasePersonSubmissions(deps, personId, email);
  if (ownInvitation) await deps.store.write({ delete: { table: "Invitation", key: { email } } });
  try {
    await deps.store.write({ delete: { table: "PersonEmail", key: { email }, when: { eq: ["personId", personId] } } });
  } catch (error) {
    // Absent, or claimed by someone else since: either way it is not this person's to delete.
    if (!(error instanceof ConditionFailed)) throw error;
  }
  await deps.store.write({ delete: { table: "Person", key: { id: personId } } });
  return { found: true, submissions };
};

export const deletePerson = async (deps: Deps, caller: Caller, args: { personId?: unknown }) => {
  const personId = typeof args.personId === "string" ? args.personId : "";
  if (!personId) throw new Refusal("NO_PERSON");
  const actor = await actorId(deps, caller);
  const { found, submissions } = await erasePerson(deps, personId);
  if (!found) throw new Refusal("NO_PERSON");
  await deps.store.write(
    activity(deps, {
      actorId: actor,
      kind: "people.deleted",
      subjectType: "Person",
      subjectId: personId,
      detail: { submissions },
    }),
  );
  return { ok: true };
};

export const eraseEmail = async (deps: Deps, caller: Caller, args: { email?: unknown }) => {
  const email = normalEmail(args.email);
  const actor = await actorId(deps, caller);
  let submissions = await eraseSubmissions(deps, email);
  const claim = await deps.store.get("PersonEmail", { email });
  let personId: string | undefined;
  if (typeof claim?.personId === "string") {
    personId = claim.personId;
    submissions += (await erasePerson(deps, personId)).submissions;
  }
  const invitation = await deps.store.get("Invitation", { email });
  if (invitation) {
    await removeUsers(deps, invitation);
    await deps.store.write({ delete: { table: "Invitation", key: { email } } });
  }
  await deps.store.write(
    activity(deps, {
      actorId: actor,
      kind: "people.deleted",
      subjectType: personId ? "Person" : "Submission",
      subjectId: personId ?? deps.id(),
      detail: { submissions },
    }),
  );
  return { ok: true };
};
