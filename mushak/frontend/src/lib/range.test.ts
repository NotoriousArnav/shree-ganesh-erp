import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_RANGE_SECONDS,
  fromInputParts,
  inputParts,
  rangeDuration,
  rangeLengthDays,
  shiftRange,
  validateRange,
} from "./range.js";

const day = 86_400;

describe("validateRange", () => {
  it("accepts a normal range", () => {
    assert.equal(validateRange({ from: 100, to: 100 + day }), null);
  });

  it("rejects an empty or backwards range", () => {
    assert.equal(
      validateRange({ from: 100, to: 100 }),
      "The end of the range must be after the start.",
    );
    assert.equal(
      validateRange({ from: 200, to: 100 }),
      "The end of the range must be after the start.",
    );
  });

  it("rejects ranges longer than 366 days", () => {
    assert.equal(
      validateRange({ from: 0, to: MAX_RANGE_SECONDS + 1 }),
      "Choose a range of 366 days or less.",
    );
    assert.equal(validateRange({ from: 0, to: MAX_RANGE_SECONDS }), null);
  });
});

describe("range helpers", () => {
  it("measures duration without going negative", () => {
    assert.equal(rangeDuration({ from: 100, to: 500 }), 400);
    assert.equal(rangeDuration({ from: 500, to: 100 }), 0);
  });

  it("rounds lengths to whole days with a minimum of one", () => {
    assert.equal(rangeLengthDays({ from: 0, to: day }), 1);
    assert.equal(rangeLengthDays({ from: 0, to: 2.4 * day }), 2);
    assert.equal(rangeLengthDays({ from: 10, to: 20 }), 1);
  });

  it("shifts a range while preserving its length", () => {
    const range = { from: 1_000, to: 1_000 + 2 * day };

    assert.deepEqual(shiftRange(range, 1), {
      from: 1_000 + 2 * day,
      to: 1_000 + 4 * day,
    });
    assert.deepEqual(shiftRange(range, -1), {
      from: 1_000 - 2 * day,
      to: 1_000,
    });
  });
});

describe("inputParts and fromInputParts", () => {
  it("round-trips a local date and time", () => {
    const epoch = Math.floor(new Date(2026, 10, 5, 14, 30, 15).getTime() / 1000);
    const parts = inputParts(epoch);

    assert.deepEqual(parts, { date: "2026-11-05", time: "14:30:15" });
    assert.equal(fromInputParts(parts.date, parts.time), epoch);
  });

  it("defaults missing seconds to zero", () => {
    const epoch = fromInputParts("2026-11-05", "14:30");
    assert.equal(
      epoch,
      Math.floor(new Date(2026, 10, 5, 14, 30, 0).getTime() / 1000),
    );
  });

  it("rejects malformed input", () => {
    assert.equal(fromInputParts("05/11/2026", "14:30"), null);
    assert.equal(fromInputParts("2026-11-05", "2:30 pm"), null);
    assert.notEqual(fromInputParts("2026-11-05", "24:99"), null);
  });
});
