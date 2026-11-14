import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { homePathForRole } from "./roles.js";

describe("homePathForRole", () => {
  it("sends platform roles to the admin area", () => {
    assert.equal(homePathForRole("super_admin"), "/admin");
    assert.equal(homePathForRole("dev"), "/admin");
  });

  it("sends shop roles to the merchant app", () => {
    assert.equal(homePathForRole("merchant"), "/app");
    assert.equal(homePathForRole("staff"), "/app");
  });

  it("falls back to the landing page for unknown or missing roles", () => {
    assert.equal(homePathForRole(undefined), "/");
    assert.equal(homePathForRole(null), "/");
    assert.equal(homePathForRole(""), "/");
    assert.equal(homePathForRole("auditor"), "/");
  });
});
