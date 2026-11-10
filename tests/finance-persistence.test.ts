import test from "node:test";
import assert from "node:assert/strict";
import { majorToMinor, minorToMajor } from "../lib/finance-persistence";

test("converts BRL major units to integer centavos without floating point drift", () => {
  assert.equal(majorToMinor(1234.56), 123456);
  assert.equal(majorToMinor(0.1 + 0.2), 30);
  assert.equal(majorToMinor(0), 0);
});

test("converts integer centavos back to major units", () => {
  assert.equal(minorToMajor(123456), 1234.56);
  assert.equal(minorToMajor(1), 0.01);
});

test("rejects unsafe, non-finite and fractional-cent values", () => {
  assert.throws(() => majorToMinor(Number.NaN), RangeError);
  assert.throws(() => majorToMinor(Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => majorToMinor(Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => minorToMajor(1.5), RangeError);
  assert.throws(() => minorToMajor(Number.MAX_SAFE_INTEGER + 1), RangeError);
});
