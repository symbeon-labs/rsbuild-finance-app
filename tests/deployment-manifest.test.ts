import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeploymentContext, validateDeploymentManifest } from "../lib/deployment/manifest";

const standaloneManifest = {
  schemaVersion: "1.0.0",
  deploymentId: "mundo-do-sabor-prod",
  mode: "standalone",
  identity: { organizationSlug: "mundo_sabor", displayName: "Mundo do Sabor" },
  controlPlane: { mode: "disabled" },
  capabilities: { finance: true, reconciliation: false, logistics: false, audit: true },
  infrastructure: {
    supabase: { urlEnv: "CUSTOMER_SUPABASE_URL", publishableKeyEnv: "CUSTOMER_SUPABASE_PUBLISHABLE_KEY", secretKeyEnv: "CUSTOMER_SUPABASE_SECRET_KEY" },
    storage: { provider: "supabase_storage", bucketEnv: "CUSTOMER_STORAGE_BUCKET" }
  },
  release: { channel: "preview" }
};
const environment = {
  CUSTOMER_SUPABASE_URL: "https://customer.supabase.co",
  CUSTOMER_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  CUSTOMER_SUPABASE_SECRET_KEY: "sb_secret_example",
  CUSTOMER_STORAGE_BUCKET: "customer-files"
};

test("accepts a valid standalone deployment manifest", () => {
  assert.equal(validateDeploymentManifest(standaloneManifest).mode, "standalone");
});
test("rejects unsupported schema versions and unknown fields", () => {
  assert.throws(() => validateDeploymentManifest({ ...standaloneManifest, schemaVersion: "2.0.0" }), /schemaVersion/);
  assert.throws(() => validateDeploymentManifest({ ...standaloneManifest, injected: true }), /desconhecido/);
});
test("rejects standalone manifests that enable the control plane", () => {
  assert.throws(() => validateDeploymentManifest({ ...standaloneManifest, controlPlane: { mode: "remote", endpointEnv: "CONTROL_PLANE_URL" } }), /standalone exige/);
});
test("rejects secret keys exposed through NEXT_PUBLIC variables", () => {
  const infrastructure = { ...standaloneManifest.infrastructure, supabase: { ...standaloneManifest.infrastructure.supabase, secretKeyEnv: "NEXT_PUBLIC_SUPABASE_SECRET" } };
  assert.throws(() => validateDeploymentManifest({ ...standaloneManifest, infrastructure }), /NEXT_PUBLIC/);
});
test("resolves an immutable server deployment context", () => {
  const context = resolveDeploymentContext(standaloneManifest, environment);
  assert.equal(context.identity.organizationSlug, "mundo_sabor");
  assert.equal(context.infrastructure.supabase.secretKey, "sb_secret_example");
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.infrastructure.supabase), true);
});
test("fails closed when required environment variables are missing", () => {
  assert.throws(() => resolveDeploymentContext(standaloneManifest, {}), /variável obrigatória ausente/);
});
test("rejects insecure non-local Supabase URLs", () => {
  assert.throws(() => resolveDeploymentContext(standaloneManifest, { ...environment, CUSTOMER_SUPABASE_URL: "http://customer.supabase.co" }), /HTTPS/);
});
test("requires a remote endpoint for managed_shared mode", () => {
  const managed = { ...standaloneManifest, mode: "managed_shared", controlPlane: { mode: "remote", endpointEnv: "CONTROL_PLANE_URL" } };
  assert.throws(() => resolveDeploymentContext(managed, environment), /variável obrigatória ausente/);
});
