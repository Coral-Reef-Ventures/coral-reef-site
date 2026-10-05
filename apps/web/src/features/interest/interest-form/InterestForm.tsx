"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { doorApi } from "../../../infrastructure/amplify/client.ts";
import { fieldLimits, type InterestField, interestOptions, labels } from "./fields.ts";
import classes from "./InterestForm.module.css";
import { type FormValues, type Invalid, submit, sourceSite, waitPhrase } from "./submit.ts";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "limited"; retryAfter: number | null }
  | { kind: "failed" };

/** What the form starts with when a visitor was just told no invitation exists for their account. */
const NO_INVITATION = "I tried to sign in with Google, and there is no invitation for that account yet.";

const contact = "hello@coralreefventures.com";

/**
 * The interest form (CRV-009). Plain controls and a script only for sending, with no cookie: the one request is a
 * guest mutation. The query is read after hydration, because the page is static: `?site=` says where the visitor
 * came from, and `?error=NOT_INVITED` means the sign-in found no invitation, so the message starts with that.
 */
export const InterestForm = () => {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [site, setSite] = useState("crv");
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState<Invalid | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSite(sourceSite(params.get("site")));
    if (params.get("error") === "NOT_INVITED") setMessage((current) => current || NO_INVITATION);
  }, []);

  useEffect(() => {
    if (state.kind === "sent") done.current?.focus();
  }, [state.kind]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    const values: FormValues = {
      name: text("name"),
      email: text("email"),
      organization: text("organization"),
      interests: data.getAll("interests").map(String),
      message: text("message"),
      site,
      website: text("website"),
    };
    setInvalid(null);
    setState({ kind: "sending" });
    const result = await submit(doorApi, values);
    if (result.kind === "invalid") {
      setState({ kind: "idle" });
      setInvalid(result.invalid);
      const first = form.current?.querySelector<HTMLElement>(`[name="${result.invalid.field}"]`);
      first?.focus();
      return;
    }
    setState(result);
  };

  if (state.kind === "sent") {
    return (
      <p ref={done} role="status" tabIndex={-1} className={classes.sent}>
        Thank you. Your details were sent.
      </p>
    );
  }

  const error = (field: InterestField) => (invalid?.field === field ? invalid.message : null);
  const describedBy = (field: InterestField) => (invalid?.field === field ? `${field}-error` : undefined);
  const busy = state.kind === "sending";

  return (
    <form ref={form} className={classes.form} onSubmit={send} noValidate aria-label="Get involved">
      <div className={classes.row}>
        <Field field="name" error={error("name")}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={fieldLimits.name}
            aria-invalid={error("name") ? true : undefined}
            aria-describedby={describedBy("name")}
          />
        </Field>
        <Field field="email" error={error("email")}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={fieldLimits.email}
            aria-invalid={error("email") ? true : undefined}
            aria-describedby={describedBy("email")}
          />
        </Field>
      </div>
      <Field field="organization" error={null} optional>
        <input id="organization" name="organization" autoComplete="organization" maxLength={fieldLimits.organization} />
      </Field>
      <fieldset className={classes.interests} aria-describedby={describedBy("interests")}>
        <legend>{labels.interests}</legend>
        {interestOptions.map((option) => (
          <label key={option.value} className={classes.choice}>
            <input type="checkbox" name="interests" value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
        {error("interests") && (
          <p id="interests-error" className={classes.error}>
            {error("interests")}
          </p>
        )}
      </fieldset>
      <Field field="message" error={error("message")}>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={fieldLimits.message}
          aria-invalid={error("message") ? true : undefined}
          aria-describedby={describedBy("message")}
        />
      </Field>
      {/* People never see or fill this field; a message that fills it is dropped. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className={classes.trap} />
      <p className={classes.notice}>
        We keep what you send here so we can read and answer it, and no longer than{" "}
        <a href="/privacy/">the privacy page</a> says. Sending it creates no account.
      </p>
      <div className={classes.actions}>
        <button type="submit" className={classes.send} disabled={busy}>
          {busy ? "Sending…" : "Send"}
        </button>
        {state.kind === "limited" && (
          <p role="alert" className={classes.error}>
            Too many messages have come from here. Please try again {waitPhrase(state.retryAfter)}, or write to{" "}
            {contact}.
          </p>
        )}
        {state.kind === "failed" && (
          <p role="alert" className={classes.error}>
            Your details could not be sent. Please try again later, or write to {contact}.
          </p>
        )}
      </div>
    </form>
  );
};

const Field = ({
  field,
  error,
  optional = false,
  children,
}: {
  field: InterestField;
  error: string | null;
  optional?: boolean;
  children: React.ReactNode;
}) => (
  <div className={classes.field}>
    <label htmlFor={field}>
      {labels[field]}
      {optional && <span className={classes.optional}> (optional)</span>}
    </label>
    {children}
    {error && (
      <p id={`${field}-error`} className={classes.error}>
        {error}
      </p>
    )}
  </div>
);
