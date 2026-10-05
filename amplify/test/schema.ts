import { data, dataFunctions } from "../data/resource.ts";

/** Amplify's schema builder, which is not part of its typed surface: `transform()` is what defineData compiles. */
type TransformedSchema = { schema: string; lambdaFunctions: Record<string, unknown> };

export const transformed = (
  data as unknown as { props: { schema: { transform: () => TransformedSchema } } }
).props.schema.transform();

export const functionNames = Object.keys(dataFunctions);
