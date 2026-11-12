import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { openapiSpec } from "../openapi.js";

/**
 * Writes the canonical OpenAPI document into the documentation tree.
 *
 * Run with `npm run docs:openapi -w lokkhi/backend`. The script imports the
 * spec from source, so it needs no database or running server.
 */
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../../../docs/api/openapi.json");

const operations = Object.values(openapiSpec.paths).reduce(
  (total, path) =>
    total +
    Object.keys(path ?? {}).filter((key) =>
      ["get", "post", "put", "patch", "delete"].includes(key),
    ).length,
  0,
);

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(openapiSpec, null, 2)}\n`, "utf8");

console.log(`Wrote ${operations} operations to ${target}`);
