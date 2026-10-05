import { isDoorAction, type Ticket } from "./enter.ts";

/** The slice of a document the post needs, so a test can hand in a stand-in. */
export type FormHost = {
  createElement(tag: "form" | "input"): HTMLFormElement | HTMLInputElement;
  body: { appendChild(node: Node): unknown };
};

/**
 * Hands the ticket to the site: a hidden form posted from this page, never a URL, so the ticket reaches no history, no
 * Referer and no log. The destination is checked again here, and a ticket for anywhere else is not posted.
 */
export const postTicket = (ticket: Ticket, doc: FormHost = document): void => {
  if (!isDoorAction(ticket.action)) throw new Error("Refusing to post a ticket to that address.");
  const form = doc.createElement("form") as HTMLFormElement;
  form.method = "POST";
  form.action = ticket.action;
  form.hidden = true;
  for (const [name, value] of [
    ["ticket", ticket.ticket],
    ["next", ticket.next],
  ] as const) {
    const input = doc.createElement("input") as HTMLInputElement;
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
};
