import process from "node:process";

import { readAuthConfig } from "./settings.ts";

/**
 * The settings this synth runs with, read and checked once (the variables are described in settings.ts). Importing
 * this module reads the environment, so a function's handler imports settings.ts instead.
 */
export const authConfig = readAuthConfig(process.env);
