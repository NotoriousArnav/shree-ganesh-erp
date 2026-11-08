import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { openapiSpec } from "../openapi.js";

/**
 * Writes the OpenAPI document into the documentation tree.
 *
 * Run with `npm run docs:openapi`. The script imports the spec from source, so
 * it does not need a database or a running server.
 */
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../../../docs/api/openapi.json");

const operationCount = Object.values(openapiSpec.paths).reduce(
  (total, path) =>
    total +
    Object.keys(path ?? {}).filter((key) =>
      ["get", "post", "put", "patch", "delete"].includes(key),
    ).length,
  0,
);

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(openapiSpec, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${operationCount} operations to ${target}`,
);
