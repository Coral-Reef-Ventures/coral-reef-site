import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { transformed } from "../test/schema.ts";

/**
 * The door's client (apps/web/src/infrastructure/amplify/client.ts) writes its GraphQL by hand, so this holds each
 * document to the schema: the operation type, every variable's type against the field's argument, and the fields it
 * selects against the type the field returns.
 */
const client = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/infrastructure/amplify/client.ts", import.meta.url)),
  "utf8",
);
const sdl = transformed.schema;

type Document = { kind: string; variables: Record<string, string>; field: string; args: string[]; selected: string[] };

const documents: Document[] = [...client.matchAll(/\/\* GraphQL \*\/ `([\s\S]*?)`/g)].map(([, text = ""]) => {
  const head = /^\s*(query|mutation) \w+(?:\(([^)]*)\))? \{\s*(\w+)(?:\(([^)]*)\))? \{([\s\S]*)\}\s*\}\s*$/.exec(text);
  if (!head) throw new Error(`Cannot read the document:\n${text}`);
  const [, kind = "", variables = "", field = "", args = "", body = ""] = head;
  return {
    kind,
    field,
    variables: Object.fromEntries(
      [...variables.matchAll(/\$(\w+): ([\w[\]!]+)/g)].map(([, name = "", type = ""]) => [name, type]),
    ),
    args: [...args.matchAll(/(\w+): \$(\w+)/g)].map(([, name = "", variable = ""]) => {
      expect(variable, `${field}.${name}`).toBe(name);
      return name;
    }),
    selected: [...body.replace(/\{[^}]*\}/g, "").matchAll(/\b(\w+)\b/g)].map(([, name = ""]) => name),
  };
});

/** A field of `type` in the SDL: its arguments by name and its return type. */
const fieldOf = (type: string, field: string) => {
  const block = new RegExp(`^type ${type} [^{]*\\{([\\s\\S]*?)^\\}`, "m").exec(sdl)?.[1] ?? "";
  const line = new RegExp(`^\\s*${field}(?:\\(([^)]*)\\))?: ([\\w[\\]!]+)`, "m").exec(block);
  if (!line) return undefined;
  const args = Object.fromEntries(
    [...(line[1] ?? "").matchAll(/(\w+): ([\w[\]!]+)/g)].map(([, name = "", t = ""]) => [name, t]),
  );
  return { args, returns: line[2] ?? "" };
};

describe("the door client's GraphQL documents", () => {
  it("are the three operations the door calls", () => {
    expect(documents.map((d) => `${d.kind} ${d.field}`)).toEqual([
      "mutation submitInterest",
      "mutation enterDoor",
      "mutation issueSiteTicket",
    ]);
  });

  it.each(documents.map((d) => [d.field, d] as const))("%s matches the schema", (_name, document) => {
    const field = fieldOf(document.kind === "query" ? "Query" : "Mutation", document.field);
    expect(field, document.field).toBeDefined();
    expect(document.variables).toEqual(field?.args);
    expect(document.args.sort()).toEqual(Object.keys(field?.args ?? {}).sort());
    const returned = (field?.returns ?? "").replace(/[[\]!]/g, "");
    for (const selected of document.selected) {
      expect(fieldOf(returned, selected), `${returned}.${selected}`).toBeDefined();
    }
  });
});
