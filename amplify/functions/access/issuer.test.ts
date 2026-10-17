import { describe, expect, it } from "vitest";

import { ticketIssuer } from "./issuer.ts";

describe("ticketIssuer", () => {
  it("is the door's own origin, as each site's gate expects", () => {
    expect(ticketIssuer("https://main.d8p3mdqo02ww3.amplifyapp.com")).toBe("https://main.d8p3mdqo02ww3.amplifyapp.com");
    expect(ticketIssuer("https://coralreefventures.com/")).toBe("https://coralreefventures.com");
  });

  it("is prod's door when the origin is unset", () => {
    expect(ticketIssuer(undefined)).toBe("https://coralreefventures.com");
    expect(ticketIssuer("")).toBe("https://coralreefventures.com");
  });
});
