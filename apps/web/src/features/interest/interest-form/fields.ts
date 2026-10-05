import type { ContactConfig } from "@coralreefventures/contact";

/** The fields and the most characters each may hold: the limits the backend enforces (§2.4), so the form agrees. */
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

/** How a visitor can take part: the values `interests` carries and the words the form shows. */
export const interestOptions = [
  { value: "funding", label: "Funding" },
  { value: "design_partner", label: "Design partner" },
  { value: "advisor", label: "Advisor" },
  { value: "other", label: "Something else" },
] as const;

/** Where a visitor came from: the three sites a form can be reached from. */
export const sourceSites = ["crv", "streamlane", "driftline"] as const;
export type SourceSite = (typeof sourceSites)[number];

export const labels: Record<InterestField, string> = {
  name: "Your name",
  email: "Email",
  organization: "Organization",
  interests: "How you would like to take part",
  message: "Message",
  site: "Site",
};
