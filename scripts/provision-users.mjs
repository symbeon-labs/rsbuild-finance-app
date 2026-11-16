#!/usr/bin/env node
/**
 * Provisiona usuários em organizações RSBUILD OS.
 *
 * Uso:
 *   node scripts/provision-users.mjs <email> <org-slug> <role> [--name "Nome"]
 *   node scripts/provision-users.mjs --file users.json
 *
 * Requer .env.local (ou variáveis de ambiente) com:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *
 * Roles válidas: owner | admin | operator | viewer
 * O script convida por e-mail (a pessoa define a senha no primeiro acesso),
 * faz upsert da membership e registra evento de auditoria.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// --- carrega .env.local sem dependência extra ---
const envFile = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) envFile[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || envFile.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || envFile.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Erro: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const VALID_ROLES = ["owner", "admin", "operator", "viewer"];

async function resolveOrgId(slug) {
  const { data, error } = await admin.from("organizations").select("id, slug, display_name").eq("slug", slug).maybeSingle();
  if (error || !data) throw new Error(`Organização não encontrada para slug "${slug}"`);
  return data;
}

async function provision({ email, orgSlug, role, fullName }) {
  if (!VALID_ROLES.includes(role)) throw new Error(`Role inválida: ${role}`);
  const emailNorm = email.trim().toLowerCase();
  const org = await resolveOrgId(orgSlug);

  // 1. usuário auth — convida se novo; se já existe, apenas garante membership
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(emailNorm, {
    data: fullName ? { full_name: fullName } : {}
  });

  let userId = invite?.user?.id ?? null;
  if (inviteError) {
    const msg = String(inviteError.message || "");
    if (/already|exists|registered/i.test(msg)) {
      // usuário já existe — localiza por listUsers (paginação simples)
      let found = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        found = list?.users?.find((u) => u.email?.toLowerCase() === emailNorm) ?? null;
        if (!list?.users?.length || list.users.length < 200) break;
      }
      if (!found) throw new Error(`Usuário ${emailNorm} parece existir mas não foi localizado: ${msg}`);
      userId = found.id;
      console.log(`  · ${emailNorm} já possui conta — membership atualizada`);
    } else {
      throw new Error(`inviteUserByEmail falhou: ${msg}`);
    }
  } else {
    console.log(`  · convite enviado para ${emailNorm}`);
  }

  // 2. membership
  const { error: memError } = await admin.from("organization_memberships").upsert({
    organization_id: org.id,
    user_id: userId,
    role
  }, { onConflict: "organization_id,user_id" });
  if (memError) throw new Error(`membership falhou: ${memError.message}`);

  // 3. auditoria
  await admin.from("audit_events").insert({
    organization_id: org.id,
    actor_id: null,
    event_type: "member.provisioned",
    entity_type: "organization_membership",
    entity_id: userId,
    metadata: { email: emailNorm, role, orgSlug, via: "provision-users script", actorEmail: "system" }
  });

  console.log(`  ✓ ${emailNorm} → ${org.display_name} (${org.slug}) como ${role}`);
  return { email: emailNorm, org: org.slug, role, userId };
}

async function main() {
  const args = process.argv.slice(2);
  let jobs = [];

  if (args[0] === "--file") {
    jobs = JSON.parse(readFileSync(args[1], "utf8"));
  } else if (args.length >= 3) {
    jobs = [{ email: args[0], orgSlug: args[1], role: args[2], fullName: args.includes("--name") ? args[args.indexOf("--name") + 1] : undefined }];
  } else {
    console.log(`Uso:
  node scripts/provision-users.mjs <email> <org-slug> <role> [--name "Nome"]
  node scripts/provision-users.mjs --file users.json

Exemplo:
  node scripts/provision-users.mjs flavio@rs2build.com.br rsbuild admin --name "Flávio"`);
    process.exit(1);
  }

  for (const job of jobs) {
    try {
      await provision(job);
    } catch (err) {
      console.error(`  ✗ ${job.email}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
