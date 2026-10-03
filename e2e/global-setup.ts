import { join } from "node:path";
import { build } from "../site/build.ts";

/** Build the site where page.spec.ts reads it. */
export default async function globalSetup(): Promise<void> {
  await build(join(import.meta.dirname, ".build"));
}
