import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, maskKey } from "../lib/erp-credentials";

const TEST_MASTER_KEY = "test-master-secret-key-at-least-32-chars";

test("encryptSecret and decryptSecret round-trip preserves plaintext", () => {
  const secret = "omie-super-secret-987654321";
  const encrypted = encryptSecret(secret, TEST_MASTER_KEY);

  assert.ok(encrypted.startsWith("enc:v1:"));
  assert.ok(!encrypted.includes(secret));
  assert.equal(decryptSecret(encrypted, TEST_MASTER_KEY), secret);
});

test("decryptSecret rejects tampered ciphertext or wrong master key", () => {
  const encrypted = encryptSecret("secret-value-123", TEST_MASTER_KEY);
  const parts = encrypted.split(":");
  parts[parts.length - 1] = parts[parts.length - 1].replace(/^./, (c) => (c === "a" ? "b" : "a"));
  const tampered = parts.join(":");

  assert.throws(() => decryptSecret(tampered, TEST_MASTER_KEY));
  assert.throws(() => decryptSecret(encrypted, "another-different-master-secret-key-123"));
});

test("maskKey hides middle characters while preserving short hints", () => {
  assert.equal(maskKey("1234567890abcdef"), "1234••••cdef");
  assert.equal(maskKey("short"), "••••••");
});
