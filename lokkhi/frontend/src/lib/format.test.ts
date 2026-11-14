import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dateLabel, money, todayIso } from "./format.js";

describe("money", () => {
  it("formats INR with the en-IN grouping", () => {
    const text = money(1234567.5);

    assert.ok(text.includes("₹"), `expected a rupee sign in ${text}`);
    assert.ok(text.includes("12,34,567.50"), `expected en-IN grouping in ${text}`);
  });

  it("formats zero", () => {
    assert.ok(money(0).includes("0.00"));
  });

  it("supports another currency", () => {
    const text = money(10, "USD");

    assert.ok(text.includes("$"));
    assert.ok(text.includes("10.00"));
  });
});

describe("dateLabel", () => {
  it("renders an ISO date in Indian short form", () => {
    assert.equal(dateLabel("2026-11-05"), "5 Nov 2026");
  });

  it("does not shift the day through UTC parsing", () => {
    assert.equal(dateLabel("2026-01-01"), "1 Jan 2026");
    assert.equal(dateLabel("2026-12-31"), "31 Dec 2026");
  });
});

describe("todayIso", () => {
  it("returns the local date as YYYY-MM-DD", () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    assert.equal(todayIso(), expected);
  });
});
