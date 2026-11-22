export type DeploymentMode = "standalone" | "managed_shared";
export type ControlPlaneMode = "disabled" | "remote";
export type ReleaseChannel = "stable" | "preview" | "development";

export interface DeploymentManifest {
  schemaVersion: "1.0.0";
  deploymentId: string;
  mode: DeploymentMode;
  identity: { organizationSlug: string; displayName: string };
  controlPlane: { mode: ControlPlaneMode; endpointEnv?: string };
  capabilities: { finance: boolean; reconciliation: boolean; logistics: boolean; audit: boolean };
  infrastructure: {
    supabase: { urlEnv: string; publishableKeyEnv: string; secretKeyEnv: string };
    storage: { provider: "supabase_storage"; bucketEnv: string };
  };
  release: { channel: ReleaseChannel };
}

export interface DeploymentContext {
  readonly deploymentId: string;
  readonly mode: DeploymentMode;
  readonly identity: Readonly<DeploymentManifest["identity"]>;
  readonly controlPlane: Readonly<{ mode: ControlPlaneMode; endpoint?: string }>;
  readonly capabilities: Readonly<DeploymentManifest["capabilities"]>;
  readonly infrastructure: Readonly<{
    supabase: Readonly<{ url: string; publishableKey: string; secretKey: string }>;
    storage: Readonly<{ provider: "supabase_storage"; bucket: string }>;
  }>;
  readonly release: Readonly<DeploymentManifest["release"]>;
}

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const DEPLOYMENT_ID = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const ORGANIZATION_SLUG = /^[a-z0-9][a-z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error("Deployment manifest inválido: campo desconhecido em " + path + ".");
  }
}
function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Deployment manifest inválido: " + path + " deve ser um objeto.");
  return value;
}
function requireString(value: unknown, path: string, min: number, max: number): string {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new Error("Deployment manifest inválido: " + path + " deve ser texto entre " + min + " e " + max + " caracteres.");
  }
  return value;
}
function requireEnvName(value: unknown, path: string): string {
  const name = requireString(value, path, 1, 128);
  if (!ENV_NAME.test(name)) throw new Error("Deployment manifest inválido: " + path + " não é um nome de variável de ambiente válido.");
  return name;
}

/** Strict runtime validation aligned with deployment/manifest.schema.json (schemaVersion 1.0.0). */
export function validateDeploymentManifest(input: unknown): DeploymentManifest {
  const root = requireRecord(input, "raiz");
  hasOnlyKeys(root, ["schemaVersion", "deploymentId", "mode", "identity", "controlPlane", "capabilities", "infrastructure", "release"], "raiz");
  if (root.schemaVersion !== "1.0.0") throw new Error("Deployment manifest inválido: schemaVersion não suportada.");
  const deploymentId = requireString(root.deploymentId, "deploymentId", 3, 80);
  if (!DEPLOYMENT_ID.test(deploymentId)) throw new Error("Deployment manifest inválido: deploymentId fora do padrão.");
  if (root.mode !== "standalone" && root.mode !== "managed_shared") throw new Error("Deployment manifest inválido: mode desconhecido.");

  const identity = requireRecord(root.identity, "identity");
  hasOnlyKeys(identity, ["organizationSlug", "displayName"], "identity");
  const organizationSlug = requireString(identity.organizationSlug, "identity.organizationSlug", 2, 80);
  if (!ORGANIZATION_SLUG.test(organizationSlug)) throw new Error("Deployment manifest inválido: organizationSlug fora do padrão.");
  const displayName = requireString(identity.displayName, "identity.displayName", 2, 120);

  const controlPlane = requireRecord(root.controlPlane, "controlPlane");
  hasOnlyKeys(controlPlane, ["mode", "endpointEnv"], "controlPlane");
  if (controlPlane.mode !== "disabled" && controlPlane.mode !== "remote") throw new Error("Deployment manifest inválido: controlPlane.mode desconhecido.");
  let endpointEnv: string | undefined;
  if (controlPlane.mode === "remote") endpointEnv = requireEnvName(controlPlane.endpointEnv, "controlPlane.endpointEnv");
  else if (controlPlane.endpointEnv !== undefined) throw new Error("Deployment manifest inválido: endpointEnv não é permitido com controlPlane disabled.");
  if (root.mode === "standalone" && controlPlane.mode !== "disabled") throw new Error("Deployment manifest inválido: standalone exige controlPlane disabled.");
  if (root.mode === "managed_shared" && controlPlane.mode !== "remote") throw new Error("Deployment manifest inválido: managed_shared exige controlPlane remote.");

  const capabilities = requireRecord(root.capabilities, "capabilities");
  const capabilityKeys = ["finance", "reconciliation", "logistics", "audit"];
  hasOnlyKeys(capabilities, capabilityKeys, "capabilities");
  const resolvedCapabilities = {} as DeploymentManifest["capabilities"];
  for (const key of capabilityKeys) {
    if (typeof capabilities[key] !== "boolean") throw new Error("Deployment manifest inválido: capabilities." + key + " deve ser booleano.");
    resolvedCapabilities[key as keyof DeploymentManifest["capabilities"]] = capabilities[key] as boolean;
  }

  const infrastructure = requireRecord(root.infrastructure, "infrastructure");
  hasOnlyKeys(infrastructure, ["supabase", "storage"], "infrastructure");
  const supabase = requireRecord(infrastructure.supabase, "infrastructure.supabase");
  hasOnlyKeys(supabase, ["urlEnv", "publishableKeyEnv", "secretKeyEnv"], "infrastructure.supabase");
  const urlEnv = requireEnvName(supabase.urlEnv, "infrastructure.supabase.urlEnv");
  const publishableKeyEnv = requireEnvName(supabase.publishableKeyEnv, "infrastructure.supabase.publishableKeyEnv");
  const secretKeyEnv = requireEnvName(supabase.secretKeyEnv, "infrastructure.supabase.secretKeyEnv");
  if (secretKeyEnv.startsWith("NEXT_PUBLIC_")) throw new Error("Deployment manifest inválido: secretKeyEnv não pode usar NEXT_PUBLIC_.");

  const storage = requireRecord(infrastructure.storage, "infrastructure.storage");
  hasOnlyKeys(storage, ["provider", "bucketEnv"], "infrastructure.storage");
  if (storage.provider !== "supabase_storage") throw new Error("Deployment manifest inválido: storage.provider não suportado.");
  const bucketEnv = requireEnvName(storage.bucketEnv, "infrastructure.storage.bucketEnv");

  const release = requireRecord(root.release, "release");
  hasOnlyKeys(release, ["channel"], "release");
  if (release.channel !== "stable" && release.channel !== "preview" && release.channel !== "development") {
    throw new Error("Deployment manifest inválido: release.channel desconhecido.");
  }

  return {
    schemaVersion: "1.0.0", deploymentId, mode: root.mode,
    identity: { organizationSlug, displayName },
    controlPlane: endpointEnv ? { mode: "remote", endpointEnv } : { mode: "disabled" },
    capabilities: resolvedCapabilities,
    infrastructure: {
      supabase: { urlEnv, publishableKeyEnv, secretKeyEnv },
      storage: { provider: "supabase_storage", bucketEnv }
    },
    release: { channel: release.channel }
  };
}

/** Resolve only server environment variables; never accept request- or browser-provided overrides. */
export function resolveDeploymentContext(manifestInput: unknown, environment: Readonly<Record<string, string | undefined>> = process.env): DeploymentContext {
  const manifest = validateDeploymentManifest(manifestInput);
  const readRequired = (name: string): string => {
    const value = environment[name];
    if (!value || !value.trim()) throw new Error("Deployment não configurado: variável obrigatória ausente (" + name + ").");
    return value.trim();
  };
  const url = readRequired(manifest.infrastructure.supabase.urlEnv);
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { throw new Error("Deployment não configurado: URL do Supabase inválida."); }
  const localHost = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
  if (parsedUrl.protocol !== "https:" && !(localHost && parsedUrl.protocol === "http:")) {
    throw new Error("Deployment não configurado: URL do Supabase deve usar HTTPS (HTTP apenas em localhost).");
  }
  const publishableKey = readRequired(manifest.infrastructure.supabase.publishableKeyEnv);
  const secretKey = readRequired(manifest.infrastructure.supabase.secretKeyEnv);
  const bucket = readRequired(manifest.infrastructure.storage.bucketEnv);
  const endpoint = manifest.controlPlane.mode === "remote" ? readRequired(manifest.controlPlane.endpointEnv as string) : undefined;
  if (endpoint) {
    let parsedEndpoint: URL;
    try { parsedEndpoint = new URL(endpoint); } catch { throw new Error("Deployment não configurado: endpoint do Control Plane inválido."); }
    if (parsedEndpoint.protocol !== "https:" && !(parsedEndpoint.hostname === "localhost" && parsedEndpoint.protocol === "http:")) {
      throw new Error("Deployment não configurado: endpoint do Control Plane deve usar HTTPS.");
    }
  }
  return Object.freeze({
    deploymentId: manifest.deploymentId, mode: manifest.mode,
    identity: Object.freeze({ ...manifest.identity }),
    controlPlane: Object.freeze({ mode: manifest.controlPlane.mode, ...(endpoint ? { endpoint } : {}) }),
    capabilities: Object.freeze({ ...manifest.capabilities }),
    infrastructure: Object.freeze({
      supabase: Object.freeze({ url, publishableKey, secretKey }),
      storage: Object.freeze({ provider: "supabase_storage" as const, bucket })
    }),
    release: Object.freeze({ ...manifest.release })
  });
}
