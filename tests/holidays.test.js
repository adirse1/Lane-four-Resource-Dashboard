// Regression guard on the working-day math. The README's authoritative sanity
// number is: April 2026 = 21 working days (CA). If this fails, the holiday
// calendar or calcWD changed and the dashboard's RPD will drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcWD, getEnabledHols, HOLIDAYS } from "../src/lib/holidays.js";

test("April 2026 has 21 CA working days (README sanity number)", () => {
  const hols = getEnabledHols(2026, "CA", {});
  assert.equal(calcWD(2026, 4, hols), 21);
});

test("toggling Good Friday OFF adds it back as a working day (22)", () => {
  // Holidays toggled off count as working days.
  const hState = { "2026-CA-2026-04-03": false };
  const hols = getEnabledHols(2026, "CA", hState);
  assert.equal(calcWD(2026, 4, hols), 22);
});

test("Canada observes Good Friday but NOT Easter Monday", () => {
  const ca2026 = HOLIDAYS[2026].CA.map((h) => h.name);
  assert.ok(ca2026.includes("Good Friday"));
  assert.ok(!ca2026.some((n) => n.includes("Easter")));
});

test("calendar weekdays (no holidays) for April 2026 is 22", () => {
  assert.equal(calcWD(2026, 4, []), 22);
});
