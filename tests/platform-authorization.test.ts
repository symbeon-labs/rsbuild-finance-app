import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdministerOrganization,
  canAdministerPlatform,
  canManageCapabilityLicenses,
  isCapabilityUsable
} from "../lib/platform-authorization";

test("organization owner administers its organization, not the platform", () => {
  assert.equal(canAdministerOrganization("owner"), true);
  assert.equal(canAdministerPlatform({ platformAdministrator: false }), false);
  assert.equal(canManageCapabilityLicenses({ platformAdministrator: false }), false);
});

test("organization admin does not receive platform privileges", () => {
  assert.equal(canAdministerOrganization("admin"), true);
  assert.equal(canAdministerPlatform({ platformAdministrator: false }), false);
});

test("only explicit platform grant enables platform administration", () => {
  assert.equal(canAdministerPlatform({ platformAdministrator: true }), true);
  assert.equal(canManageCapabilityLicenses({ platformAdministrator: true }), true);
});

test("capability requires granted license, active implementation and environment scope", () => {
  const base = {
    licenseStatus: "granted" as const,
    operationalStatus: "active" as const,
    environment: "qa" as const,
    entitledEnvironments: ["qa"] as ("qa" | "sandbox" | "production")[]
  };
  assert.equal(isCapabilityUsable(base), true);
  assert.equal(isCapabilityUsable({ ...base, environment: "production" }), false);
  assert.equal(isCapabilityUsable({ ...base, licenseStatus: "suspended" }), false);
  assert.equal(isCapabilityUsable({ ...base, operationalStatus: "in_development" }), false);
});
