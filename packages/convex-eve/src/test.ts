/// <reference types="vite/client" />

import type { GenericSchema, SchemaDefinition } from "convex/server";
import type { TestConvex } from "convex-test";
import schema from "../convex/schema.js";

export const modules = import.meta.glob("../convex/**/*.ts");

/** Register convex-eve with a convex-test instance. */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "eve",
) {
  t.registerComponent(name, schema, modules);
}

export { schema };
export default { modules, register, schema };
