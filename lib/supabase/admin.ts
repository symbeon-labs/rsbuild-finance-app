import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Accept only elevated Supabase credentials for cross-tenant server operations.
 * A publishable/anon key can construct a client successfully but will fail
 * later with PostgreSQL permission errors (42501), which obscures the actual
 * configuration problem.
 */
function isElevatedKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;

  // Legacy service_role keys are JWTs. Inspect only the role claim; never log
  // or return the token itself.
  if (key.startsWith("eyJ")) {
    try {
      const payload = key.split(".")[1];
      if (!payload) return false;
      const decoded = JSON.parse(
        Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      );
      return decoded.role === "service_role";
    } catch {
      return false;
    }
  }

  return false;
}

export function getAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const candidates = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ].filter((value): value is string => Boolean(value));

  const secretKey = candidates.find(isElevatedKey);
  if (!url || !secretKey) {
    console.error(JSON.stringify({
      event: "supabase_admin_client_configuration_invalid",
      hasSupabaseUrl: Boolean(url),
      hasSecretKey: candidates.length > 0,
      hasElevatedKey: candidates.some(isElevatedKey),
      configuredKeyKinds: candidates.map((key) =>
        key.startsWith("sb_secret_") ? "secret" :
        key.startsWith("eyJ") ? "legacy_jwt" : "unknown"
      )
    }));
    return null;
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

export function createAdminClient() {
  const client = getAdminClient();
  if (!client) throw new Error("Supabase elevated server key is missing or invalid.");
  return client;
}
