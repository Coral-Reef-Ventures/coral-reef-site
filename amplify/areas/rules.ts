/**
 * The one rule every model carries (plan §2.3): admins read, nobody writes through the API. Each model also disables
 * its generated mutations and subscriptions, so there is no generated write from any client; crv-access and
 * crv-interest write the tables directly, and the schema-level `allow.resource` rules let the triggers and the
 * retention sweep call their operations.
 */
// biome-ignore lint/suspicious/noExplicitAny: Amplify's authorization callback type is not exported.
export const adminsRead = (allow: any) => [allow.group("admins").to(["read"])];

export const noGeneratedWrites = ["mutations", "subscriptions"] as const;
