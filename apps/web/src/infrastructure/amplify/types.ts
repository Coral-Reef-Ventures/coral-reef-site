/** What the form sends to `submitInterest` (§2.4): one string per field, the interests joined by commas. */
export type InterestInput = {
  name: string;
  email: string;
  organization: string;
  interests: string;
  message: string;
  site: string;
  website: string;
};

/** `submitInterest` returns nothing but whether it was taken and, if not, when to try again. */
export type InterestAnswer = { ok: boolean; retryAfter?: number | null };

export type EnterDoorAnswer = {
  invited: boolean;
  grants: { site: string; host: string }[];
  admin: boolean;
  reason?: "REVOKED" | "EMAIL_CHANGED" | "NOT_BOUND" | null;
};

export type TicketAnswer = { action: string; ticket: string };

export type TicketRequest = { site: string; next: string; state: string; host: string };

/** How a return from Google ended: the state the door carried through the redirect, or why it did not work. */
export type RedirectOutcome = { customState?: string; error?: string };

/**
 * Everything the door asks of the backend and of sign-in, in one place. The components know this and nothing of
 * Amplify, so a test or the screen suite swaps in a stub with the same shape.
 */
export type DoorApi = {
  /** The one public operation: a guest mutation. */
  submitInterest(input: InterestInput): Promise<InterestAnswer>;
  /** Whether a signed-in session is live in this browser. */
  hasSession(): Promise<boolean>;
  /** On the page Google returns to: waits for the code exchange and says how it ended. */
  completeRedirect(): Promise<RedirectOutcome>;
  signInWithGoogle(customState?: string): Promise<void>;
  /** Ends the Cognito session everywhere. With the hosted sign-in it leaves the page and returns to /signout/done/. */
  signOut(): Promise<void>;
  enterDoor(): Promise<EnterDoorAnswer>;
  issueSiteTicket(request: TicketRequest): Promise<TicketAnswer>;
};
