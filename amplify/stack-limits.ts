/**
 * The CloudFormation ceilings a deploy meets and a synth does not report, copied from Streamlane (ADR 0055 there).
 * CloudFormation allows 500 resources in one stack and a 1 MB template, and refuses a deploy over either after the
 * synth has passed. `stack-limits.test.ts` holds every stack to the limits below, which sit under CloudFormation's so a
 * branch fails its tests while there is still room to change course.
 */

/** Resources one stack may hold. CloudFormation's limit is 500. */
export const stackResourceLimit = 450;

/** Bytes one template may hold, as synthesized. CloudFormation's limit for a template read from S3 is 1 MB. */
export const templateByteLimit = 900_000;

export type SynthesizedTemplate = { file: string; bytes: number; resourceTypes: string[] };

/** Each stack over its resource or size limit, in words that name the stack and the limit. */
export function stackProblems(templates: SynthesizedTemplate[]): string[] {
  const problems: string[] = [];
  for (const { file, bytes, resourceTypes } of templates) {
    if (resourceTypes.length > stackResourceLimit) {
      problems.push(
        `${file} holds ${resourceTypes.length} resources, over the ${stackResourceLimit} allowed (CloudFormation refuses a stack over 500).`,
      );
    }
    if (bytes > templateByteLimit) {
      problems.push(
        `${file} is ${bytes} bytes, over the ${templateByteLimit} allowed (CloudFormation refuses a template over 1 MB).`,
      );
    }
  }
  return problems;
}

/** An operation the schema hands to a Lambda function, read from the schema's GraphQL. */
export type FunctionOperation = { typeName: string; fieldName: string; functionName: string };

const typeLine = /^type (\w+) \{/;
const functionField = /^\s*(\w+)(?:\([^)]*\))?:\s*[^\s@]+\s.*@function\(name: "([^"]+)"/;

/** Every `@function` operation in the schema's GraphQL, as Amplify's `transform()` writes it (one field per line). */
export function functionOperations(sdl: string): FunctionOperation[] {
  const operations: FunctionOperation[] = [];
  let typeName = "";
  for (const line of sdl.split("\n")) {
    const type = typeLine.exec(line);
    if (type) {
      typeName = type[1] ?? "";
      continue;
    }
    const field = functionField.exec(line);
    if (field) operations.push({ typeName, fieldName: field[1] ?? "", functionName: field[2] ?? "" });
  }
  return operations;
}

/**
 * Each operation handed the function object (`a.handler.function(crvAccess)`, which gives it six resources of its own)
 * or naming a function defineData was not given.
 */
export function handlerProblems(
  operations: FunctionOperation[],
  objectFormFunctions: string[],
  namedFunctions: string[],
): string[] {
  const problems: string[] = [];
  for (const { typeName, fieldName, functionName } of operations) {
    const operation = `${typeName}.${fieldName}`;
    if (objectFormFunctions.includes(functionName)) {
      problems.push(`${operation} passes the function object to a.handler.function; name it with a string.`);
    } else if (!namedFunctions.includes(functionName)) {
      problems.push(`${operation} names "${functionName}", which is not among defineData's functions.`);
    }
  }
  return problems;
}
