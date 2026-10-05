import type { ContactConfig } from "@coralreefventures/contact";

/**
 * The form's fields and the most characters each may hold (plan §2.4). The door's form uses the same limits
 * (apps/web/src/features/interest/interest-form/fields.ts) and the same parser, so the two agree.
 */
export const fieldLimits = {
  name: 120,
  email: 254,
  organization: 200,
  interests: 100,
  message: 4000,
  site: 20,
} as const;

export type InterestField = keyof typeof fieldLimits;

export const contactConfig: ContactConfig<InterestField> = {
  fields: fieldLimits,
  required: ["name", "email", "interests", "message"],
  email: "email",
};

/** The schema's `Interest` and `SourceSite` enums, in their order. */
export const interestValues = ["funding", "design_partner", "advisor", "other"] as const;
export const sourceSiteValues = ["crv", "streamlane", "driftline"] as const;
