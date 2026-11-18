import test from "node:test";
import assert from "node:assert/strict";
import { formatDatePtBr, formatDateTimePtBr, todayIsoDateSaoPaulo } from "../lib/date-format";

test("formatDatePtBr formats calendar dates without timezone drift", () => {
  assert.equal(formatDatePtBr("2026-11-18"), "18/11/2026");
});

test("formatDatePtBr rejects impossible calendar dates", () => {
  assert.equal(formatDatePtBr("2026-02-31"), "2026-02-31");
});

test("formatDatePtBr formats timestamps in Sao Paulo timezone", () => {
  assert.equal(formatDatePtBr("2026-11-18T02:30:00.000Z"), "17/11/2026");
});

test("formatDateTimePtBr formats timestamps in Sao Paulo timezone", () => {
  assert.equal(formatDateTimePtBr("2026-11-18T14:30:00.000Z"), "18/11/2026 11:30");
});

test("formatters preserve empty and invalid values safely", () => {
  assert.equal(formatDatePtBr(null), "—");
  assert.equal(formatDateTimePtBr("not-a-date"), "not-a-date");
});

test("todayIsoDateSaoPaulo derives the calendar day from Sao Paulo", () => {
  assert.equal(todayIsoDateSaoPaulo(new Date("2026-11-18T02:30:00.000Z")), "2026-11-17");
});
