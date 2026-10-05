import { type Model, models } from "./models.ts";

/** The environment variable that carries each model's table name: TABLE_PERSON, TABLE_PERSON_EMAIL, ... */
export const tableVariable = (model: Model): string =>
  `TABLE_${model.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;

/** Each model's physical table name, from the variables backend.ts sets. A missing one is left out and refused on use. */
export const tableEnvironment = (env: Record<string, string | undefined>): Record<string, string> => {
  const tables: Record<string, string> = {};
  for (const model of models) {
    const name = env[tableVariable(model)];
    if (name) tables[model] = name;
  }
  return tables;
};
