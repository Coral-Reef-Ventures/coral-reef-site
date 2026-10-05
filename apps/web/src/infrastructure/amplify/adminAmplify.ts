import {
  ACTIVITY_AREAS,
  type Activity,
  type ActivityArea,
  type ActivityQuery,
  type AdminApi,
  INVITATION_STATUSES,
  type Invitation,
  type InvitationStatus,
  type Interest,
  SITES,
  type SiteId,
  SUBMISSION_STATUSES,
  type Submission,
  type SubmissionStatus,
} from "./api.ts";

/**
 * The AdminApi over the deployed backend (plan §2.3): the generated admin-read queries of Submission, Invitation,
 * AccessGrant and Activity, by their secondary indexes, and the admin mutations crv-access handles. Every call is made
 * with the signed-in admin's user pool token. The views get exactly what the stub (adminStub.ts) gives them: optional
 * fields absent rather than null, an Invitation's `sites` from its person's active grants and `bound` from its
 * `cognitoSub`, lists newest first.
 *
 * Each document is written out in full, with no interpolation, so amplify/data/client-documents.test.ts can check every
 * one against the synthesized schema. A failure reaches the views as a code alone (errorCode), never a message that
 * could carry a value.
 */

/** The one corner of the generated client this uses (client.ts makes it). */
export type GraphqlClient = {
  graphql(options: { query: string; variables: object; authMode: string }): Promise<unknown>;
};

/** Each request's page size, the most rows a list returns, and how many pages one list may ask for. */
export const PAGE_SIZE = 100;
export const MAX_ROWS = 500;
export const MAX_GRANTS = 5000;
export const MAX_PAGES = 50;
export const DEFAULT_ACTIVITY = 100;

const codeShape = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * A failure as a code: the backend's refusal (`ALREADY_BOUND`, `NO_INVITATION`, `CONFLICT`, ...), `UNAUTHORIZED` when
 * AppSync turns the caller away, `SIGNED_OUT` when there is no session to send, and `REQUEST_FAILED` for anything else,
 * since another message (a validation error, say) may quote a variable.
 */
export const errorCode = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    const { name, errors } = error as { name?: unknown; errors?: unknown };
    if (name === "NoSignedUser" || name === "NoValidAuthTokens") return "SIGNED_OUT";
    const first = Array.isArray(errors) ? (errors[0] as { message?: unknown; errorType?: unknown }) : undefined;
    if (first) {
      if (typeof first.message === "string" && codeShape.test(first.message)) return first.message;
      if (first.errorType === "Unauthorized" || first.message === "Unauthorized") return "UNAUTHORIZED";
    }
  }
  return "REQUEST_FAILED";
};

type Page<T> = { items: (T | null)[]; nextToken?: string | null };

/** Pages through a list until it ends, `max` rows are kept, or MAX_PAGES have been asked for. */
const collect = async <T>(
  fetch: (limit: number, nextToken: string | undefined) => Promise<Page<T>>,
  max: number,
  keep: (row: T) => boolean = () => true,
  pageSize = PAGE_SIZE,
): Promise<T[]> => {
  const rows: T[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_PAGES && rows.length < max; page += 1) {
    const result = await fetch(Math.min(pageSize, max - rows.length), nextToken);
    for (const item of result.items ?? []) if (item && keep(item)) rows.push(item);
    nextToken = result.nextToken ?? undefined;
    if (!nextToken) break;
  }
  return rows.slice(0, max);
};

const newest =
  <T>(field: (row: T) => string) =>
  (a: T, b: T) =>
    field(b).localeCompare(field(a));

/** `{ [key]: value }` when the value is set, `{}` when the backend sent null: the views' types leave the field out. */
const some = <K extends string, V>(key: K, value: V | null | undefined) =>
  (value === null || value === undefined ? {} : { [key]: value }) as { [P in K]?: V };

/** Variables without the keys left undefined, so an argument not given is absent rather than null. */
const defined = (variables: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined));

type RawSubmission = {
  id: string;
  name: string;
  email: string;
  organization?: string | null;
  interests?: Interest[] | null;
  message: string;
  sourceSite: Submission["sourceSite"];
  status: SubmissionStatus;
  statusAt: string;
  notes?: string | null;
  receivedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  personId?: string | null;
};

const submissionOf = (raw: RawSubmission): Submission => ({
  id: raw.id,
  name: raw.name,
  email: raw.email,
  organization: raw.organization ?? "",
  interests: [...(raw.interests ?? [])],
  message: raw.message,
  sourceSite: raw.sourceSite,
  status: raw.status,
  statusAt: raw.statusAt,
  notes: raw.notes ?? "",
  receivedAt: raw.receivedAt,
  ...some("reviewedBy", raw.reviewedBy),
  ...some("reviewedAt", raw.reviewedAt),
  ...some("personId", raw.personId),
});

type RawInvitation = {
  email: string;
  personId?: string | null;
  submissionId?: string | null;
  status: InvitationStatus;
  statusAt: string;
  cognitoSub?: string | null;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  note?: string | null;
};

/** InvitationView, which crv-access builds from the same fields with `bound` and `sites` already worked out. */
type RawInvitationView = Omit<RawInvitation, "cognitoSub"> & { bound: boolean; sites: string[] };

/** Known sites only, in the registry's order, as the backend's activeSites gives them. */
const sitesOf = (hosts: Iterable<string>): SiteId[] => {
  const held = new Set(hosts);
  return SITES.filter((site) => held.has(site));
};

const invitationFields = (raw: RawInvitation | RawInvitationView) => ({
  email: raw.email,
  ...some("personId", raw.personId),
  ...some("submissionId", raw.submissionId),
  status: raw.status,
  statusAt: raw.statusAt,
  invitedBy: raw.invitedBy,
  invitedAt: raw.invitedAt,
  ...some("acceptedAt", raw.acceptedAt),
  ...some("revokedAt", raw.revokedAt),
  ...some("note", raw.note),
});

const viewOf = (raw: RawInvitationView): Invitation => ({
  ...invitationFields(raw),
  bound: raw.bound,
  sites: sitesOf(raw.sites),
});

/** A listed Invitation: bound once an identity accepted it (cognitoSub set, as crv-access decides it). */
const listedOf = (raw: RawInvitation, sites: SiteId[]): Invitation => ({
  ...invitationFields(raw),
  bound: typeof raw.cognitoSub === "string",
  sites,
});

type RawGrant = { personId: string; resource: string; status: string };

type RawActivity = {
  id: string;
  personId?: string | null;
  actorId: string;
  area: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  at: string;
  detail?: unknown;
};

/** AWSJSON arrives as a string; anything but an object is no detail. */
const detailOf = (value: unknown): Record<string, unknown> | undefined => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
};

const activityOf = (raw: RawActivity): Activity => ({
  id: raw.id,
  ...some("personId", raw.personId),
  actorId: raw.actorId,
  area: raw.area as ActivityArea,
  kind: raw.kind,
  subjectType: raw.subjectType,
  subjectId: raw.subjectId,
  at: raw.at,
  ...some("detail", detailOf(raw.detail)),
});

export function createAmplifyAdminApi(client: GraphqlClient): AdminApi {
  const call = async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
    let result: { data?: T | null; errors?: unknown[] };
    try {
      result = (await client.graphql({ query, variables: defined(variables), authMode: "userPool" })) as typeof result;
    } catch (error) {
      throw new Error(errorCode(error));
    }
    if (result?.errors?.length) throw new Error(errorCode(result));
    if (result?.data === undefined || result.data === null) throw new Error("REQUEST_FAILED");
    return result.data;
  };

  const submissionsByStatus = (status: SubmissionStatus) =>
    collect<RawSubmission>(async (limit, nextToken) => {
      const data = await call<{ listSubmissionsByStatus: Page<RawSubmission> }>(
        /* GraphQL */ `
          query ListSubmissionsByStatus($status: SubmissionStatus!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String) {
            listSubmissionsByStatus(status: $status, sortDirection: $sortDirection, limit: $limit, nextToken: $nextToken) {
              items {
                id
                name
                email
                organization
                interests
                message
                sourceSite
                status
                statusAt
                notes
                receivedAt
                reviewedBy
                reviewedAt
                personId
              }
              nextToken
            }
          }
        `,
        { status, sortDirection: "DESC", limit, nextToken },
      );
      return data.listSubmissionsByStatus;
    }, MAX_ROWS);

  const invitationsByStatus = (status: InvitationStatus) =>
    collect<RawInvitation>(async (limit, nextToken) => {
      const data = await call<{ listInvitationsByStatus: Page<RawInvitation> }>(
        /* GraphQL */ `
          query ListInvitationsByStatus($status: InvitationStatus!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String) {
            listInvitationsByStatus(status: $status, sortDirection: $sortDirection, limit: $limit, nextToken: $nextToken) {
              items {
                email
                personId
                submissionId
                status
                statusAt
                cognitoSub
                invitedBy
                invitedAt
                acceptedAt
                revokedAt
                note
              }
              nextToken
            }
          }
        `,
        { status, sortDirection: "DESC", limit, nextToken },
      );
      return data.listInvitationsByStatus;
    }, MAX_ROWS);

  /** Who holds an active grant for each site: one indexed query per site, whatever the number of invitations. */
  const activeSitesByPerson = async (): Promise<Map<string, SiteId[]>> => {
    const held = new Map<string, Set<string>>();
    await Promise.all(
      SITES.map(async (site) => {
        const grants = await collect<RawGrant>(
          async (limit, nextToken) => {
            const data = await call<{ listAccessGrantsByResource: Page<RawGrant> }>(
              /* GraphQL */ `
                query ListAccessGrantsByResource($resource: String!, $filter: ModelAccessGrantFilterInput, $limit: Int, $nextToken: String) {
                  listAccessGrantsByResource(resource: $resource, filter: $filter, limit: $limit, nextToken: $nextToken) {
                    items {
                      personId
                      resource
                      status
                    }
                    nextToken
                  }
                }
              `,
              { resource: `site:${site}`, filter: { status: { eq: "active" } }, limit, nextToken },
            );
            return data.listAccessGrantsByResource;
          },
          MAX_GRANTS,
          (grant) => grant.status === "active",
          1000,
        );
        for (const grant of grants) {
          const sites = held.get(grant.personId) ?? new Set<string>();
          sites.add(site);
          held.set(grant.personId, sites);
        }
      }),
    );
    return new Map([...held].map(([personId, sites]) => [personId, sitesOf(sites)]));
  };

  type ActivityIndex = "listActivityByArea" | "listActivityByPerson" | "listActivityBySubject";

  const activityPage = async (index: ActivityIndex, key: string, limit: number, nextToken: string | undefined) => {
    if (index === "listActivityBySubject") {
      const data = await call<{ listActivityBySubject: Page<RawActivity> }>(
        /* GraphQL */ `
          query ListActivityBySubject($subjectId: String!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String) {
            listActivityBySubject(subjectId: $subjectId, sortDirection: $sortDirection, limit: $limit, nextToken: $nextToken) {
              items {
                id
                personId
                actorId
                area
                kind
                subjectType
                subjectId
                at
                detail
              }
              nextToken
            }
          }
        `,
        { subjectId: key, sortDirection: "DESC", limit, nextToken },
      );
      return data.listActivityBySubject;
    }
    if (index === "listActivityByPerson") {
      const data = await call<{ listActivityByPerson: Page<RawActivity> }>(
        /* GraphQL */ `
          query ListActivityByPerson($personId: ID!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String) {
            listActivityByPerson(personId: $personId, sortDirection: $sortDirection, limit: $limit, nextToken: $nextToken) {
              items {
                id
                personId
                actorId
                area
                kind
                subjectType
                subjectId
                at
                detail
              }
              nextToken
            }
          }
        `,
        { personId: key, sortDirection: "DESC", limit, nextToken },
      );
      return data.listActivityByPerson;
    }
    const data = await call<{ listActivityByArea: Page<RawActivity> }>(
      /* GraphQL */ `
        query ListActivityByArea($area: String!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String) {
          listActivityByArea(area: $area, sortDirection: $sortDirection, limit: $limit, nextToken: $nextToken) {
            items {
              id
              personId
              actorId
              area
              kind
              subjectType
              subjectId
              at
              detail
            }
            nextToken
          }
        }
      `,
      { area: key, sortDirection: "DESC", limit, nextToken },
    );
    return data.listActivityByArea;
  };

  const mutateInvitation = async <K extends string>(field: K, query: string, variables: Record<string, unknown>) => {
    const data = await call<Record<K, RawInvitationView>>(query, variables);
    return viewOf(data[field]);
  };

  return {
    async listSubmissions(status) {
      const lists = await Promise.all((status ? [status] : SUBMISSION_STATUSES).map(submissionsByStatus));
      return lists
        .flat()
        .sort(newest((row) => row.receivedAt))
        .slice(0, MAX_ROWS)
        .map(submissionOf);
    },

    async getSubmission(id) {
      const data = await call<{ getSubmission: RawSubmission | null }>(
        /* GraphQL */ `
          query GetSubmission($id: ID!) {
            getSubmission(id: $id) {
              id
              name
              email
              organization
              interests
              message
              sourceSite
              status
              statusAt
              notes
              receivedAt
              reviewedBy
              reviewedAt
              personId
            }
          }
        `,
        { id },
      );
      return data.getSubmission ? submissionOf(data.getSubmission) : null;
    },

    async updateSubmission({ id, status, notes }) {
      const data = await call<{ updateSubmission: RawSubmission | null }>(
        /* GraphQL */ `
          mutation UpdateSubmission($id: ID!, $status: SubmissionStatus, $notes: String) {
            updateSubmission(id: $id, status: $status, notes: $notes) {
              id
              name
              email
              organization
              interests
              message
              sourceSite
              status
              statusAt
              notes
              receivedAt
              reviewedBy
              reviewedAt
              personId
            }
          }
        `,
        { id, status, notes },
      );
      if (!data.updateSubmission) throw new Error("NO_SUBMISSION");
      return submissionOf(data.updateSubmission);
    },

    async listInvitations(status) {
      const [lists, sites] = await Promise.all([
        Promise.all((status ? [status] : INVITATION_STATUSES).map(invitationsByStatus)),
        activeSitesByPerson(),
      ]);
      return lists
        .flat()
        .sort(newest((row) => row.invitedAt))
        .slice(0, MAX_ROWS)
        .map((raw) => listedOf(raw, (raw.personId && sites.get(raw.personId)) || []));
    },

    async invite({ email, sites, submissionId, note }) {
      const data = await call<{ invite: { invitation: RawInvitationView; text: string } }>(
        /* GraphQL */ `
          mutation Invite($email: String!, $sites: [String!]!, $submissionId: ID, $note: String) {
            invite(email: $email, sites: $sites, submissionId: $submissionId, note: $note) {
              invitation {
                email
                personId
                submissionId
                status
                statusAt
                bound
                invitedBy
                invitedAt
                acceptedAt
                revokedAt
                note
                sites
              }
              text
            }
          }
        `,
        { email, sites: [...sites], submissionId, note },
      );
      return { invitation: viewOf(data.invite.invitation), text: data.invite.text };
    },

    revokeInvitation(email) {
      return mutateInvitation(
        "revokeInvitation",
        /* GraphQL */ `
          mutation RevokeInvitation($email: String!) {
            revokeInvitation(email: $email) {
              email
              personId
              submissionId
              status
              statusAt
              bound
              invitedBy
              invitedAt
              acceptedAt
              revokedAt
              note
              sites
            }
          }
        `,
        { email },
      );
    },

    restoreInvitation(email) {
      return mutateInvitation(
        "restoreInvitation",
        /* GraphQL */ `
          mutation RestoreInvitation($email: String!) {
            restoreInvitation(email: $email) {
              email
              personId
              submissionId
              status
              statusAt
              bound
              invitedBy
              invitedAt
              acceptedAt
              revokedAt
              note
              sites
            }
          }
        `,
        { email },
      );
    },

    setGrants(email, sites) {
      return mutateInvitation(
        "setGrants",
        /* GraphQL */ `
          mutation SetGrants($email: String!, $sites: [String!]!) {
            setGrants(email: $email, sites: $sites) {
              email
              personId
              submissionId
              status
              statusAt
              bound
              invitedBy
              invitedAt
              acceptedAt
              revokedAt
              note
              sites
            }
          }
        `,
        { email, sites: [...sites] },
      );
    },

    rebindInvitation(email, newEmail) {
      return mutateInvitation(
        "rebindInvitation",
        /* GraphQL */ `
          mutation RebindInvitation($email: String!, $newEmail: String) {
            rebindInvitation(email: $email, newEmail: $newEmail) {
              email
              personId
              submissionId
              status
              statusAt
              bound
              invitedBy
              invitedAt
              acceptedAt
              revokedAt
              note
              sites
            }
          }
        `,
        { email, newEmail },
      );
    },

    async deletePerson(personId) {
      await call<{ deletePerson: { ok: boolean } }>(
        /* GraphQL */ `
          mutation DeletePerson($personId: ID!) {
            deletePerson(personId: $personId) {
              ok
            }
          }
        `,
        { personId },
      );
    },

    async eraseEmail(email) {
      await call<{ eraseEmail: { ok: boolean } }>(
        /* GraphQL */ `
          mutation EraseEmail($email: String!) {
            eraseEmail(email: $email) {
              ok
            }
          }
        `,
        { email },
      );
    },

    async listActivity({ area, personId, subjectId, limit = DEFAULT_ACTIVITY }: ActivityQuery = {}) {
      const max = Math.max(1, Math.min(Math.floor(limit), MAX_ROWS));
      // The narrowest index the query names; any other condition it names is applied to what that index returns.
      const keep = (row: RawActivity) =>
        (!area || row.area === area) &&
        (!personId || row.personId === personId) &&
        (!subjectId || row.subjectId === subjectId);
      const from = (index: ActivityIndex, key: string) =>
        collect<RawActivity>((size, nextToken) => activityPage(index, key, size, nextToken), max, keep);
      let rows: RawActivity[];
      if (subjectId) rows = await from("listActivityBySubject", subjectId);
      else if (personId) rows = await from("listActivityByPerson", personId);
      else if (area) rows = await from("listActivityByArea", area);
      else rows = (await Promise.all(ACTIVITY_AREAS.map((each) => from("listActivityByArea", each)))).flat();
      return rows
        .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
        .slice(0, max)
        .map(activityOf);
    },
  };
}
