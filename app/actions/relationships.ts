"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidBrazilianDocument, normalizeDocument } from "@/lib/brazilian-documents";

const RELATIONSHIP_TYPES = [
  "cliente", "fornecedor", "transportadora", "parceiro_comercial",
  "prestador_servico", "distribuidor", "outros"
] as const;
const STATUSES = ["active", "inactive", "archived"] as const;

export type RelationshipInput = {
  id?: string;
  document?: string;
  legalName: string;
  tradeName?: string;
  relationshipTypes: string[];
  stateRegistration?: string;
  email?: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  status?: string;
  notes?: string;
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

function validate(input: RelationshipInput) {
  const legalName = clean(input.legalName, 180);
  const document = clean(input.document, 32);
  const types = Array.isArray(input.relationshipTypes)
    ? [...new Set(input.relationshipTypes.filter((item) => RELATIONSHIP_TYPES.includes(item as typeof RELATIONSHIP_TYPES[number])))]
    : [];
  const status = input.status ?? "active";

  if (!legalName || legalName.length < 2) return { error: "Informe a razão social ou nome." };
  if (types.length === 0) return { error: "Selecione ao menos uma classificação." };
  if (document && !isValidBrazilianDocument(document)) return { error: "CPF/CNPJ inválido. Confira os dígitos verificadores." };
  if (!STATUSES.includes(status as typeof STATUSES[number])) return { error: "Status inválido." };
  const email = clean(input.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." };
  const state = clean(input.state, 2)?.toUpperCase() ?? null;
  if (state && !/^[A-Z]{2}$/.test(state)) return { error: "Informe uma UF com duas letras." };

  return {
    value: {
      document: document ? normalizeDocument(document) : null,
      legal_name: legalName,
      trade_name: clean(input.tradeName, 180),
      relationship_types: types,
      state_registration: clean(input.stateRegistration, 40),
      email,
      phone: clean(input.phone, 40),
      street_address: clean(input.streetAddress, 220),
      city: clean(input.city, 120),
      state,
      status,
      notes: clean(input.notes, 2000)
    }
  };
}

async function authorize(organizationId: string, write = false) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Sessão inválida. Entre novamente." } as const;

  const { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership) return { error: "Você não possui acesso a esta organização." } as const;
  if (write && !["owner", "admin", "operator"].includes(membership.role)) {
    return { error: "Seu perfil possui acesso somente para consulta." } as const;
  }
  return { supabase, user } as const;
}

export async function listRelationships(organizationId: string, search = "", status = "all") {
  const auth = await authorize(organizationId);
  if ("error" in auth) return { ok: false as const, error: auth.error, records: [] };
  let query = auth.supabase
    .from("organization_relationships")
    .select("id, document, legal_name, trade_name, relationship_types, state_registration, email, phone, street_address, city, state, status, notes, source, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("legal_name", { ascending: true })
    .limit(500);

  if (status !== "all" && STATUSES.includes(status as typeof STATUSES[number])) query = query.eq("status", status);
  const term = search.trim().slice(0, 80);
  if (term) query = query.or(`legal_name.ilike.%${term.replace(/[,()%]/g, " ")}%,trade_name.ilike.%${term.replace(/[,()%]/g, " ")}%,document.ilike.%${term.replace(/[,()%]/g, " ")}%,email.ilike.%${term.replace(/[,()%]/g, " ")}%`);

  const { data, error } = await query;
  if (error) return { ok: false as const, error: "Não foi possível carregar os relacionamentos.", records: [] };
  return { ok: true as const, records: data ?? [] };
}

export async function saveRelationship(organizationId: string, input: RelationshipInput) {
  const auth = await authorize(organizationId, true);
  if ("error" in auth) return { ok: false as const, error: auth.error };
  const validated = validate(input);
  if ("error" in validated) return { ok: false as const, error: validated.error };
  const payload = { ...validated.value, organization_id: organizationId, updated_by: auth.user.id };

  if (input.id) {
    const { data, error } = await auth.supabase
      .from("organization_relationships")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false as const, error: error.code === "23505" ? "Já existe um cadastro com este CPF/CNPJ nesta organização." : "Não foi possível atualizar o cadastro." };
    if (!data) return { ok: false as const, error: "Cadastro não encontrado ou sem permissão para alteração." };
  } else {
    const { error } = await auth.supabase
      .from("organization_relationships")
      .insert({ ...payload, created_by: auth.user.id });
    if (error) return { ok: false as const, error: error.code === "23505" ? "Já existe um cadastro com este CPF/CNPJ nesta organização." : "Não foi possível criar o cadastro." };
  }

  revalidatePath("/");
  return { ok: true as const };
}

export async function getRelationshipHistory(organizationId: string, relationshipId: string) {
  const auth = await authorize(organizationId);
  if ("error" in auth) return { ok: false as const, error: auth.error, events: [] };
  const { data: relationship } = await auth.supabase
    .from("organization_relationships").select("id")
    .eq("id", relationshipId).eq("organization_id", organizationId).maybeSingle();
  if (!relationship) return { ok: false as const, error: "Cadastro não encontrado.", events: [] };
  const { data, error } = await auth.supabase
    .from("organization_relationship_events")
    .select("id, event_type, changed_fields, occurred_at, actor_id")
    .eq("relationship_id", relationshipId)
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false as const, error: "Não foi possível carregar o histórico.", events: [] };
  return { ok: true as const, events: data ?? [] };
}
