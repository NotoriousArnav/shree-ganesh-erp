import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { quantityError, unitAllowsFraction, unitStep } from "./units.js";

describe("unitAllowsFraction", () => {
  it("allows fractions for measured units", () => {
    for (const unit of ["kg", "g", "litre", "ml", "m", "ft"]) {
      assert.equal(unitAllowsFraction(unit), true, unit);
    }
  });

  it("rejects fractions for counted units", () => {
    for (const unit of ["pcs", "box", "dozen", "strip", "set"]) {
      assert.equal(unitAllowsFraction(unit), false, unit);
    }
  });

  it("ignores case and surrounding spaces", () => {
    assert.equal(unitAllowsFraction(" KG "), true);
    assert.equal(unitAllowsFraction(" Box "), false);
  });

  it("treats unknown custom units as countable", () => {
    assert.equal(unitAllowsFraction("thali"), false);
    assert.equal(unitAllowsFraction(""), false);
  });
});

describe("unitStep", () => {
  it("returns 1 for counted units and 0.001 for measured ones", () => {
    assert.equal(unitStep("pcs"), 1);
    assert.equal(unitStep("kg"), 0.001);
    assert.equal(unitStep("custom"), 1);
  });
});

describe("quantityError", () => {
  it("accepts positive whole numbers for counted units", () => {
    assert.equal(quantityError("pcs", 3), null);
  });

  it("rejects fractions for counted units", () => {
    assert.equal(quantityError("pcs", 2.5), "Use a whole number for pcs");
  });

  it("accepts fractions for measured units", () => {
    assert.equal(quantityError("kg", 1.25), null);
  });

  it("rejects zero, negatives and non-finite values", () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(
        quantityError("kg", value),
        "Quantity must be more than zero",
        String(value),
      );
    }
  });
});
