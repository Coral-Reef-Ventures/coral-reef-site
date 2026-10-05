import { describe, expect, it } from "vitest";

import {
  functionOperations,
  handlerProblems,
  stackProblems,
  stackResourceLimit,
  templateByteLimit,
} from "./stack-limits.ts";
import { functionNames, transformed } from "./test/schema.ts";
import { templates } from "./test/templates.ts";

const resolvers = (count: number) => Array.from({ length: count }, () => "AWS::AppSync::Resolver");

describe("the stack limits", () => {
  it("refuses a stack over the resource limit or a template over the size limit, and passes one at each", () => {
    expect(
      stackProblems([{ file: "at.json", bytes: templateByteLimit, resourceTypes: resolvers(stackResourceLimit) }]),
    ).toEqual([]);
    expect(
      stackProblems([
        { file: "over.json", bytes: templateByteLimit + 1, resourceTypes: resolvers(stackResourceLimit + 1) },
      ]),
    ).toEqual([
      expect.stringMatching(/^over\.json holds 451 resources, over the 450 allowed/),
      expect.stringMatching(/^over\.json is 900001 bytes, over the 900000 allowed/),
    ]);
  });

  it("refuses the object form and a name defineData was not given", () => {
    const op = { typeName: "Mutation", fieldName: "invite", functionName: "crvAccess" };
    expect(handlerProblems([op], [], ["crvAccess"])).toEqual([]);
    expect(handlerProblems([{ ...op, functionName: "FnInvite" }], ["FnInvite"], [])).toEqual([
      expect.stringMatching(/^Mutation\.invite passes the function object/),
    ]);
    expect(handlerProblems([{ ...op, functionName: "x" }], [], ["crvAccess"])).toEqual([
      'Mutation.invite names "x", which is not among defineData\'s functions.',
    ]);
  });
});

describe("the schema's handlers", () => {
  const operations = functionOperations(transformed.schema);
  it("names every function operation's handler with a string defineData was given", () => {
    // The thirteen operations, so the check cannot pass for want of anything to read.
    expect(operations).toHaveLength(13);
    expect(handlerProblems(operations, Object.keys(transformed.lambdaFunctions), functionNames)).toEqual([]);
    expect(Object.keys(transformed.lambdaFunctions)).toEqual([]);
    expect(operations.filter((op) => op.functionName === "crvInterest").map((op) => op.fieldName)).toEqual([
      "submitInterest",
    ]);
  });
});

describe.each(["sandbox", "branch"] as const)("the %s synth", (type) => {
  it("keeps every stack under its resource limit and every template under its size limit", () => {
    const all = templates(type).map(({ file, bytes, template }) => ({
      file,
      bytes,
      resourceTypes: Object.values(template.Resources ?? {}).map((resource) => resource.Type),
    }));
    // The root, auth, data and the data stack's nested stacks, at least.
    expect(all.length).toBeGreaterThan(8);
    expect(stackProblems(all)).toEqual([]);
  });
});
