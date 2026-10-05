import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { inject } from "vitest";

export type Resource = {
  Type: string;
  Properties?: Record<string, unknown>;
  DependsOn?: string | string[];
  DeletionPolicy?: string;
};
export type Template = { Resources?: Record<string, Resource>; Outputs?: Record<string, unknown> };

/** One synthesized template: its file, its size and its parsed JSON. */
export type Synthesized = { file: string; bytes: number; template: Template };

/** Every template of one synth: the root stack first, then the nested stacks. */
export const templates = (type: "sandbox" | "branch"): Synthesized[] => {
  const dir = join(inject("synthDir"), type);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".template.json"))
    .sort((a, b) => Number(a.includes(".nested.")) - Number(b.includes(".nested.")))
    .map((file) => ({
      file,
      bytes: statSync(join(dir, file)).size,
      template: JSON.parse(readFileSync(join(dir, file), "utf8")) as Template,
    }));
};

/** The nested stack whose file name carries `name` (`auth`, `data`), excluding the data stack's own children. */
export const nested = (type: "sandbox" | "branch", name: "auth" | "data"): Template => {
  const found = templates(type).find(({ file }) => new RegExp(`[a-f0-9]{10}${name}[0-9A-F]{8}\\.nested`).test(file));
  if (!found) throw new Error(`No ${name} stack in the ${type} synth`);
  return found.template;
};

export const resourcesOf = (template: Template, type: string): [string, Resource][] =>
  Object.entries(template.Resources ?? {}).filter(([, resource]) => resource.Type === type);
