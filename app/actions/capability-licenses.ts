"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const LICENSE_STATUSES = ["blocked", "granted", "suspended", "revoked"] as const;
const OPERATIONAL_STATUSES = ["not_implemented", "in_development", "available", "active"] as const;

export async function setCapabilityLicense(input: {
  organizationId: string;
  capabilityKey: string;
  licenseStatus: string;
  operationalStatus: string;
  reason?: string;
  entitledEnvironments: string[];
  expiresAt?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Sessão inválida. Entre novamente." };

  const { data: isPlatformAdministrator, error: platformAdminError } =
    await supabase.rpc("is_platform_administrator");

  if (platformAdminError || isPlatformAdministrator !== true) {
    return { ok: false, error: "Ação restrita a um administrador autorizado da plataforma Symbeon." };
  }

  if (!input.organizationId || !input.capabilityKey ||
      !LICENSE_STATUSES.includes(input.licenseStatus as typeof LICENSE_STATUSES[number]) ||
      !OPERATIONAL_STATUSES.includes(input.operationalStatus as typeof OPERATIONAL_STATUSES[number]) ||
      !Array.isArray(input.entitledEnvironments) ||
      input.entitledEnvironments.some((environment) => !["qa", "sandbox", "production"].includes(environment)) ||
      (input.licenseStatus === "granted" && input.entitledEnvironments.length === 0)) {
    return { ok: false, error: "Configuração de capacidade inválida." };
  }

  const { error } = await supabase.rpc("set_organization_capability_license", {
    p_organization_id: input.organizationId,
    p_capability_key: input.capabilityKey,
    p_license_status: input.licenseStatus,
    p_operational_status: input.operationalStatus,
    p_reason: input.reason?.trim() || null,
    p_entitled_environments: input.entitledEnvironments,
    p_expires_at: input.expiresAt || null
  });

  if (error) return { ok: false, error: error.message.includes("42501")
    ? "Ação não autorizada para este usuário."
    : "Não foi possível salvar a licença. Verifique se as migrations estão aplicadas." };

  revalidatePath("/");
  return { ok: true };
}

export async function getCapabilityLicensingData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sessão inválida." };

  const { data: isPlatformAdministrator, error: platformAdminError } =
    await supabase.rpc("is_platform_administrator");

  if (platformAdminError || isPlatformAdministrator !== true) {
    return { ok: false as const, error: "Acesso restrito a um administrador autorizado da plataforma Symbeon." };
  }

  const [{ data: catalog, error: catalogError }, { data: licenses, error: licensesError },
    { data: events, error: eventsError }, { data: organizations, error: organizationsError }] = await Promise.all([
    supabase.from("capability_catalog").select("capability_key, display_name, description").order("display_name"),
    supabase.from("organization_capability_licenses").select("organization_id, capability_key, license_status, operational_status, notes, granted_at, updated_at, entitled_environments, expires_at"),
    supabase.from("capability_license_events").select("id, organization_id, capability_key, event_type, reason, created_at, actor_id").order("created_at", { ascending: false }).limit(50),
    supabase.from("organizations").select("id, display_name, slug").order("display_name")
  ]);

  if (catalogError || licensesError || eventsError || organizationsError) {
    return { ok: false as const, error: "Não foi possível carregar os dados de licenciamento. Verifique as migrations e permissões." };
  }

  return { ok: true as const, catalog: catalog ?? [], licenses: licenses ?? [], events: events ?? [], organizations: organizations ?? [] };
}
