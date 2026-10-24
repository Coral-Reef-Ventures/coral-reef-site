import { a } from "@aws-amplify/backend";

import { adminsRead, noGeneratedWrites } from "../rules.ts";

/**
 * Page counts (CRV-017): how many times each page was requested on a day, and from which site, counted by crv-visits
 * from the host's own access logs. A row is an aggregate and nothing else: never an address, a browser, a full referrer
 * URL or anything that tells one visitor from another. Index names match amplify/functions/shared/models.ts.
 */
export const visits = {
  PageCount: a
    .model({
      // `${day}|${path}|${referrer}`, so a day counted again overwrites its own rows.
      id: a.id().required(),
      // The host the requests were made to, such as coralreefventures.com.
      site: a.string().required(),
      // The UTC day of the requests.
      day: a.date().required(),
      path: a.string().required(),
      // A hostname without `www.`, `direct` when the request named none, or `internal` for the site's own pages.
      referrer: a.string().required(),
      count: a.integer().required(),
      // DynamoDB TTL, epoch seconds (plan §2.3a).
      expiresAt: a.timestamp(),
    })
    .secondaryIndexes((index) => [index("site").sortKeys(["day"]).name("bySite").queryField("listPageCountsBySite")])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),
};
