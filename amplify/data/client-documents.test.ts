import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, inject, it } from "vitest";

/**
 * The GraphQL documents written by hand, held to the schema AppSync is given: the door's client
 * (apps/web/src/infrastructure/amplify/client.ts), the admin views' (adminAmplify.ts beside it) and the triggers' and
 * sweep's (functions/shared/data-client.ts).
 * The schema is the transformed one from the synth, so generated index queries are there too. For each document: the
 * operation type, every variable's type against the field's argument, every required argument supplied, and the fields
 * it selects present on the type the field returns.
 */
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const synthDir = join(inject("synthDir"), "sandbox");
const schemaFile = readdirSync(synthDir).find((file) => file.endsWith(".graphql"));
const sdl = schemaFile ? readFileSync(join(synthDir, schemaFile), "utf8") : "";

type Document = { kind: string; field: string; variables: Record<string, string>; args: string[]; body: string };

const parse = (source: string): Document[] =>
  [...source.matchAll(/\/\* GraphQL \*\/ `([\s\S]*?)`/g)].map(([, text = ""]) => {
    const head = /^\s*(query|mutation) \w+(?:\(([^)]*)\))? \{\s*(\w+)(?:\(([^)]*)\))? \{([\s\S]*)\}\s*\}\s*$/.exec(
      text,
    );
    if (!head) throw new Error(`Cannot read the document:\n${text}`);
    const [, kind = "", variables = "", field = "", args = "", body = ""] = head;
    return {
      kind,
      field,
      body,
      variables: Object.fromEntries(
        [...variables.matchAll(/\$(\w+): ([\w[\]!]+)/g)].map(([, name = "", type = ""]) => [name, type]),
      ),
      args: [...args.matchAll(/(\w+): \$(\w+)/g)].map(([, name = "", variable = ""]) => {
        expect(variable, `${field}.${name}`).toBe(name);
        return name;
      }),
    };
  });

/** A field of `type` in the SDL: its arguments by name and its return type. */
const fieldOf = (type: string, field: string) => {
  const block = new RegExp(`^type ${type}\\b[^{]*\\{([\\s\\S]*?)^\\}`, "m").exec(sdl)?.[1] ?? "";
  const line = new RegExp(`^\\s*${field}(?:\\(([^)]*)\\))?: ([\\w[\\]!]+)`, "m").exec(block);
  if (!line) return undefined;
  const args = Object.fromEntries(
    [...(line[1] ?? "").matchAll(/(\w+): ([\w[\]!]+)/g)].map(([, name = "", t = ""]) => [name, t]),
  );
  return { args, returns: (line[2] ?? "").replace(/[[\]!]/g, "") };
};

/** Every selected field exists on its type, one nesting level deep (`items { personId }`). */
const checkSelection = (type: string, body: string) => {
  for (const [, name = "", nested] of body.matchAll(/(\w+)(\s*\{([^}]*)\})?/g)) {
    const field = fieldOf(type, name);
    expect(field, `${type}.${name}`).toBeDefined();
    if (nested) checkSelection(field?.returns ?? "", nested.replace(/[{}]/g, ""));
  }
};

const check = (document: Document) => {
  const field = fieldOf(document.kind === "query" ? "Query" : "Mutation", document.field);
  expect(field, document.field).toBeDefined();
  for (const [name, type] of Object.entries(document.variables)) expect(type, name).toBe(field?.args[name]);
  const required = Object.entries(field?.args ?? {}).filter(([, type]) => type.endsWith("!"));
  for (const [name] of required) expect(document.args, `${document.field} needs ${name}`).toContain(name);
  expect(document.args.sort()).toEqual(Object.keys(document.variables).sort());
  checkSelection(field?.returns ?? "", document.body);
};

describe("the hand-written GraphQL documents", () => {
  it("have a transformed schema to be checked against", () => {
    expect(sdl).toContain("type Mutation");
    expect(sdl).toContain("listInvitationsByStatus(");
  });

  const door = parse(read("../../apps/web/src/infrastructure/amplify/client.ts"));
  it("the door's are the three operations it calls", () => {
    expect(door.map((d) => `${d.kind} ${d.field}`)).toEqual([
      "mutation submitInterest",
      "mutation enterDoor",
      "mutation issueSiteTicket",
    ]);
  });
  it.each(door.map((d) => [d.field, d] as const))("the door's %s matches the schema", (_name, d) => check(d));

  const admin = parse(read("../../apps/web/src/infrastructure/amplify/adminAmplify.ts"));
  it("the admin views' are the admin-read queries they list by and the admin mutations", () => {
    expect(admin.map((d) => `${d.kind} ${d.field}`)).toEqual([
      "query listSubmissionsByStatus",
      "query listInvitationsByStatus",
      "query listAccessGrantsByResource",
      "query listActivityBySubject",
      "query listActivityByPerson",
      "query listActivityByArea",
      "query getSubmission",
      "mutation updateSubmission",
      "mutation invite",
      "mutation revokeInvitation",
      "mutation restoreInvitation",
      "mutation setGrants",
      "mutation rebindInvitation",
      "mutation deletePerson",
      "mutation eraseEmail",
    ]);
  });
  it.each(admin.map((d) => [d.field, d] as const))("the admin views' %s matches the schema", (_name, d) => check(d));

  it("lets the user pool reach every operation and type the admin views use, for the admins group", () => {
    for (const d of admin) {
      const root = d.kind === "query" ? "Query" : "Mutation";
      const block = new RegExp(`^type ${root}\\b[^{]*\\{([\\s\\S]*?)^\\}`, "m").exec(sdl)?.[1] ?? "";
      expect(new RegExp(`^\\s*${d.field}\\b[^\\n]*@aws_cognito_user_pools`, "m").test(block), d.field).toBe(true);
    }
    for (const type of ["InvitationView", "InviteResult", "Done"]) {
      expect(
        new RegExp(`^type ${type} @aws_cognito_user_pools\\(cognito_groups: \\["admins"\\]\\)`, "m").test(sdl),
        type,
      ).toBe(true);
    }
  });

  const backend = parse(read("../functions/shared/data-client.ts"));
  it("the backend's are the triggers' two and the sweep's two", () => {
    expect(backend.map((d) => d.field)).toEqual([
      "checkAdmission",
      "admitSignIn",
      "listInvitationsByStatus",
      "deletePerson",
    ]);
  });
  it.each(backend.map((d) => [d.field, d] as const))("the backend's %s matches the schema", (_name, d) => check(d));

  it("lets IAM reach every operation and type the triggers and the sweep use", () => {
    for (const type of ["Admission", "Done", "ModelInvitationConnection", "Invitation"]) {
      expect(new RegExp(`^type ${type} [^{]*@aws_iam`, "m").test(sdl), type).toBe(true);
    }
    for (const field of ["checkAdmission", "admitSignIn", "listInvitationsByStatus", "deletePerson"]) {
      expect(new RegExp(`^\\s*${field}\\([^)]*\\): [^\\n]*@aws_iam`, "m").test(sdl), field).toBe(true);
    }
  });
});
