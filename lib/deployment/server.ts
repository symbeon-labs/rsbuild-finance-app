import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveDeploymentContext, type DeploymentContext } from "./manifest";

const MANIFEST_RELATIVE_PATH = path.join("deployment", "manifest.json");

/** Loads deployment identity exclusively from the server filesystem and process environment. */
export async function loadDeploymentContext(): Promise<DeploymentContext> {
  const manifestPath = path.join(process.cwd(), MANIFEST_RELATIVE_PATH);
  let rawManifest: string;
  try {
    rawManifest = await readFile(manifestPath, "utf8");
  } catch {
    throw new Error("Deployment não configurado: deployment/manifest.json não encontrado ou inacessível.");
  }
  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(rawManifest) as unknown;
  } catch {
    throw new Error("Deployment não configurado: deployment/manifest.json contém JSON inválido.");
  }
  return resolveDeploymentContext(parsedManifest, process.env);
}
