import { parseContact } from "@coralreefventures/contact";

import type { DoorApi, Interest, InterestInput } from "../../../infrastructure/amplify/types.ts";
import { contactConfig, type InterestField, interestOptions, labels, type SourceSite, sourceSites } from "./fields.ts";

export type FormValues = {
  name: string;
  email: string;
  organization: string;
  /** The values of the interests ticked. */
  interests: readonly string[];
  message: string;
  site: string;
  /** The honeypot: people never see it, so a value means a bot. */
  website: string;
};

export type Invalid = { field: InterestField; message: string };

export type SubmitResult =
  | { kind: "sent" }
  | { kind: "invalid"; invalid: Invalid }
  | { kind: "limited"; retryAfter: number | null }
  | { kind: "failed" };

/** `crv` unless the visitor arrived from a product site that the form knows. */
export const sourceSite = (value: string | null | undefined): SourceSite =>
  (sourceSites as readonly string[]).includes(value ?? "") ? (value as SourceSite) : "crv";

const friendly = (field: InterestField, error: string): string => {
  if (error.includes("is required")) {
    return field === "interests" ? "Choose at least one way to take part." : `${labels[field]} is required.`;
  }
  if (error.includes("not an email")) return "Enter a valid email address.";
  if (error.includes("longer than")) return `${labels[field]} is too long.`;
  return `${labels[field]} is not valid.`;
};

/** The ticked interests the schema knows, each once, in the form's order. */
const knownInterests = (values: readonly string[]): Interest[] =>
  interestOptions.map((option) => option.value).filter((value) => values.includes(value));

/**
 * The body the backend takes, or the first field that is wrong. Checked with the same parser and limits as the
 * backend (the interests joined, as it checks them), then sent in the schema's types: the interests as a list of
 * `Interest` values and the site as a `SourceSite`.
 */
export const validate = (
  values: FormValues,
): { ok: true; body: Omit<InterestInput, "website"> } | { ok: false; invalid: Invalid } => {
  const interests = knownInterests(values.interests);
  const site = sourceSite(values.site);
  const parsed = parseContact(
    {
      name: values.name,
      email: values.email,
      organization: values.organization,
      interests: interests.join(","),
      message: values.message,
      site,
    },
    contactConfig,
  );
  if ("error" in parsed) {
    const field = parsed.error.split(" ")[0] as InterestField;
    return { ok: false, invalid: { field, message: friendly(field, parsed.error) } };
  }
  return {
    ok: true,
    body: {
      name: parsed.name,
      email: parsed.email,
      organization: parsed.organization,
      interests,
      message: parsed.message,
      site,
    },
  };
};

/** "in about 20 minutes", for a rate-limited answer. */
export const waitPhrase = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) return "later";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
};

/** Validate, then send. A filled honeypot is answered as if it worked and goes nowhere, as the backend does. */
export const submit = async (api: Pick<DoorApi, "submitInterest">, values: FormValues): Promise<SubmitResult> => {
  if (values.website !== "") return { kind: "sent" };
  const checked = validate(values);
  if (!checked.ok) return { kind: "invalid", invalid: checked.invalid };
  try {
    const answer = await api.submitInterest({ ...checked.body, website: "" });
    if (answer.ok) return { kind: "sent" };
    return { kind: "limited", retryAfter: answer.retryAfter ?? null };
  } catch {
    return { kind: "failed" };
  }
};
