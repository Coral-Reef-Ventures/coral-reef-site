import { a } from "@aws-amplify/backend";

import { adminsRead, noGeneratedWrites } from "../rules.ts";

/**
 * The spine (plan §2.3): Person, the address claim PersonEmail (each address belongs to exactly one Person), and one
 * Activity timeline every area writes to. A submission claims nothing here; only an admin's invite or an invitation's
 * binding does. Index names match amplify/functions/shared/models.ts.
 */
export const people = {
  PersonSource: a.enum(["interest", "invitation", "admin"]),

  Person: a
    .model({
      id: a.id().required(),
      email: a.string().required(),
      name: a.string(),
      // The bound identity, set together when the Invitation binds (plan §2.2).
      cognitoUsername: a.string(),
      cognitoSub: a.string(),
      googleSub: a.string(),
      source: a.ref("PersonSource").required(),
      // Null until the CRM area exists.
      organizationId: a.id(),
    })
    .secondaryIndexes((index) => [index("cognitoSub").name("bySub").queryField("listPeopleBySub")])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),

  PersonEmail: a
    .model({
      email: a.string().required(),
      personId: a.id().required(),
    })
    .identifier(["email"])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),

  Activity: a
    .model({
      id: a.id().required(),
      // Absent on a submission's Activity, which names its Submission as subject instead.
      personId: a.id(),
      actorId: a.string().required(),
      area: a.string().required(),
      kind: a.string().required(),
      subjectType: a.string().required(),
      subjectId: a.string().required(),
      at: a.datetime().required(),
      // Ids, counts and words: never an address, a token or a message body.
      detail: a.json(),
      // DynamoDB TTL, epoch seconds (plan §2.3a).
      expiresAt: a.timestamp(),
    })
    .secondaryIndexes((index) => [
      index("personId").sortKeys(["at"]).name("byPerson").queryField("listActivityByPerson"),
      index("subjectId").sortKeys(["at"]).name("bySubject").queryField("listActivityBySubject"),
      index("area").sortKeys(["at"]).name("byArea").queryField("listActivityByArea"),
    ])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),
};
