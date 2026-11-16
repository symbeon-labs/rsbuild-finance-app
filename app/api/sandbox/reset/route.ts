import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * API para resetar a sandbox (limpar dados e re-seed).
 * Apenas owners da RSBUILD podem resetar a sandbox.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (!consumeRateLimit(`${user.id}:/api/sandbox/reset`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // Verificar se o usuário é owner da RSBUILD
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("user_id", user.id)
      .eq("organizations.slug", "rsbuild")
      .maybeSingle();

    if (membershipError || !membership || membership.role !== "owner") {
      return NextResponse.json({ error: "sandbox_reset_forbidden" }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({
        success: false,
        message: "Admin client not configured. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to enable sandbox reset."
      }, { status: 503 });
    }

    // Limpar todas as tabelas da sandbox (ordem importa por causa de FKs)
    const tables = [
      "audit_events",
      "delivery_proofs",
      "receivable_titles",
      "financial_records",
      "financial_accounts",
      "organization_memberships",
      "organizations"
    ];

    const errors: string[] = [];
    for (const table of tables) {
      const { error } = await admin.schema("sandbox").from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.error(`Failed to clear sandbox.${table}:`, error);
        errors.push(table);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Failed to clear tables: ${errors.join(", ")}. Re-run seed migration manually.`
      }, { status: 500 });
    }

    // Re-seed com dados sintéticos (migrando do seed.sql)
    // 1. Create organizations
    const { data: orgs } = await admin.schema("sandbox").from("organizations").insert([
      { slug: 'hub-acai-sandbox', display_name: 'Hub Açaí Sandbox', description: 'Ambiente de testes para Hub Açaí - dados sintéticos' },
      { slug: 'mundo-sabor-sandbox', display_name: 'Mundo do Sabor Sandbox', description: 'Ambiente de testes para Mundo do Sabor - dados sintéticos' },
      { slug: 'rsbuild-sandbox', display_name: 'RSBUILD Sandbox', description: 'Ambiente de testes interno RSBUILD - dados sintéticos' }
    ]).select();

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ success: false, message: "Seed failed at organizations" }, { status: 500 });
    }

    const hubAcai = orgs.find(o => o.slug === 'hub-acai-sandbox');
    const mundoSabor = orgs.find(o => o.slug === 'mundo-sabor-sandbox');
    const rsbuild = orgs.find(o => o.slug === 'rsbuild-sandbox');

    if (!hubAcai || !mundoSabor || !rsbuild) {
      return NextResponse.json({ success: false, message: "Seed failed: missing organizations" }, { status: 500 });
    }

    // 2. Create memberships
    await admin.schema("sandbox").from("organization_memberships").insert([
      { organization_id: rsbuild.id, user_id: '00000000-0000-0000-0000-000000000001', role: 'owner', custom_title: 'Sandbox Admin' },
      { organization_id: hubAcai.id, user_id: '00000000-0000-0000-0000-000000000002', role: 'admin', custom_title: 'Test Admin' },
      { organization_id: mundoSabor.id, user_id: '00000000-0000-0000-0000-000000000003', role: 'operator', custom_title: 'Test Operator' }
    ]);

    // 3. Create financial accounts
    const { data: accounts } = await admin.schema("sandbox").from("financial_accounts").insert([
      { organization_id: hubAcai.id, name: 'Conta Corrente Sandbox', institution: 'Banco Teste', account_type: 'checking', currency: 'BRL' },
      { organization_id: mundoSabor.id, name: 'Conta Poupança Sandbox', institution: 'Banco Teste', account_type: 'savings', currency: 'BRL' }
    ]).select();

    // 4. Create financial records
    if (accounts && accounts.length > 0) {
      await admin.schema("sandbox").from("financial_records").insert([
        { organization_id: hubAcai.id, account_id: accounts[0].id, direction: 'entrada', amount_cents: 150000, description: 'Venda Sandbox - Pedido #12345', transaction_date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
        { organization_id: mundoSabor.id, account_id: accounts[1].id, direction: 'saída', amount_cents: 50000, description: 'Pagamento Sandbox - Fornecedor', transaction_date: new Date(Date.now() - 172800000).toISOString().split('T')[0] }
      ]);
    }

    // 5. Create receivable titles
    await admin.schema("sandbox").from("receivable_titles").insert([
      { organization_id: hubAcai.id, title_number: 'TIT-SANDBOX-001', customer_name: 'Cliente Teste Sandbox', amount_cents: 250000, due_date: new Date(Date.now() + 604800000).toISOString().split('T')[0], status: 'pending' },
      { organization_id: mundoSabor.id, title_number: 'TIT-SANDBOX-002', customer_name: 'Cliente Teste Sandbox 2', amount_cents: 180000, due_date: new Date(Date.now() + 1209600000).toISOString().split('T')[0], status: 'pending' }
    ]);

    // 6. Create delivery proofs
    await admin.schema("sandbox").from("delivery_proofs").insert([
      { organization_id: hubAcai.id, order_number: 'PED-SANDBOX-001', customer_name: 'Cliente Teste Sandbox', delivery_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], status: 'delivered' },
      { organization_id: mundoSabor.id, order_number: 'PED-SANDBOX-002', customer_name: 'Cliente Teste Sandbox 2', delivery_date: new Date().toISOString().split('T')[0], status: 'pending' }
    ]);

    // 7. Create audit events
    await admin.schema("sandbox").from("audit_events").insert([
      { organization_id: rsbuild.id, actor_id: '00000000-0000-0000-0000-000000000001', actor_email: 'sandbox-admin@test.com', event_type: 'sandbox.test.created', entity_type: 'sandbox_organization', entity_id: rsbuild.id, metadata: { test: true, timestamp: new Date().toISOString() } }
    ]);

    return NextResponse.json({
      success: true,
      message: "Sandbox reset successfully with synthetic test data."
    });
  } catch (err: any) {
    console.error("Critical error in /api/sandbox/reset:", err);
    return NextResponse.json({ error: "sandbox_reset_error" }, { status: 500 });
  }
}
