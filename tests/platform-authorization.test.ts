import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdministerOrganization,
  canAdministerPlatform,
  canManageCapabilityLicenses,
  isCapabilityUsable,
  resolveOrganizationEnvironment,
  resolveOrganizationEnvironment
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
  assert.equal(isCapabilityUsable({ ...base, expiresAt: "2020-01-01T00:00:00.000Z", now: new Date("2026-11-18T12:00:00.000Z") }), false);
  assert.equal(isCapabilityUsable({ ...base, expiresAt: "not-a-date", now: new Date("2026-11-18T12:00:00.000Z") }), false);
  assert.equal(isCapabilityUsable({ ...base, expiresAt: "2027-01-01T00:00:00.000Z", now: new Date("2026-11-18T12:00:00.000Z") }), true);
});


test("organization environment is resolved from its trusted server-side slug", () => {
  assert.equal(resolveOrganizationEnvironment("mundo_sabor_qa"), "qa");
  assert.equal(resolveOrganizationEnvironment("hub_acai_qa"), "qa");
  assert.equal(resolveOrganizationEnvironment("rsbuild_qa_alpha"), "qa");
  assert.equal(resolveOrganizationEnvironment("mundo_sabor"), "production");
  assert.equal(resolveOrganizationEnvironment("hub_acai"), "production");
});


test("organization environment is resolved from the persisted slug", () => {
  assert.equal(resolveOrganizationEnvironment("mundo_sabor"), "production");
  assert.equal(resolveOrganizationEnvironment("mundo_sabor_qa"), "qa");
  assert.equal(resolveOrganizationEnvironment("rsbuild_qa_alpha"), "qa");
});
