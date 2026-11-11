import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_NAV_ITEMS,
  ORGANIZATION_PRESETS,
  EnabledModulesConfig,
  ModuleType,
  NavItem
} from "../app/types/workspace.js";

test("GOV-01: Os 4 produtos do portfólio estão definidos e tipados nos presets das organizações", () => {
  const rsbuild = ORGANIZATION_PRESETS.find((p) => p.id === "rsbuild");
  const hubAcai = ORGANIZATION_PRESETS.find((p) => p.id === "hub_acai");
  const mundoSabor = ORGANIZATION_PRESETS.find((p) => p.id === "mundo_sabor");

  assert.ok(rsbuild, "RSBUILD deve estar cadastrado");
  assert.ok(hubAcai, "Hub Açaí deve estar cadastrado");
  assert.ok(mundoSabor, "Mundo do Sabor deve estar cadastrado");

  // RSBUILD: 1-Finanças, 2-Reconciliação e 4-Auditoria
  assert.equal(rsbuild.enabledModules.finance, true);
  assert.equal(rsbuild.enabledModules.reconciliation, true);
  assert.equal(rsbuild.enabledModules.logistics, false);
  assert.equal(rsbuild.enabledModules.audit, true);

  // Hub Açaí: 2-Reconciliação, 3-Logística e 4-Auditoria
  assert.equal(hubAcai.enabledModules.finance, false);
  assert.equal(hubAcai.enabledModules.reconciliation, true);
  assert.equal(hubAcai.enabledModules.logistics, true);
  assert.equal(hubAcai.enabledModules.audit, true);

  // Mundo do Sabor: Suíte completa (1, 2, 3 e 4)
  assert.equal(mundoSabor.enabledModules.finance, true);
  assert.equal(mundoSabor.enabledModules.reconciliation, true);
  assert.equal(mundoSabor.enabledModules.logistics, true);
  assert.equal(mundoSabor.enabledModules.audit, true);
});

test("GOV-02: Produto 2 (Reconciliação ERP) opera de forma 100% independente dos módulos de nível 1", () => {
  // Cenário: Cliente que contrata APENAS Reconciliação ERP
  const standaloneReconciliation: EnabledModulesConfig = {
    finance: false,
    reconciliation: true,
    logistics: false,
    audit: false
  };

  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.module === "all") return true;
    if (!standaloneReconciliation[item.module]) return false;
    return item.module === "reconciliation";
  });

  // Deve ter Visão Geral e a tela de Baixas & Reconciliação ERP
  assert.ok(visibleItems.some((i) => i.id === "visao-geral"), "Visão Geral deve estar acessível");
  assert.ok(visibleItems.some((i) => i.id === "baixas"), "Baixas & Reconciliação deve estar acessível");
  assert.ok(!visibleItems.some((i) => i.id === "movimentacoes"), "Movimentações de finanças não devem aparecer");
  assert.ok(!visibleItems.some((i) => i.id === "pedidos-ha"), "Pedidos de logística não devem aparecer");
});

test("GOV-03: Produto 4 (Auditoria / Agente RS) isola itens periciais e de compliance jurídico", () => {
  const auditItems = ALL_NAV_ITEMS.filter((i) => i.module === "audit");
  assert.equal(auditItems.length, 1);
  assert.equal(auditItems[0].id, "torre-controle");
  assert.equal(auditItems[0].label, "Auditoria & Torre RS");
});

test("GOV-04: Filtragem de menu respeita estritamente o módulo ativo e os produtos contratados", () => {
  function getItems(activeModule: ModuleType, enabledModules: EnabledModulesConfig): NavItem[] {
    return ALL_NAV_ITEMS.filter((item) => {
      if (item.module === "all") return true;
      if (!enabledModules[item.module]) return false;
      return item.module === activeModule;
    });
  }

  const allActive: EnabledModulesConfig = {
    finance: true,
    reconciliation: true,
    logistics: true,
    audit: true
  };

  const finItems = getItems("finance", allActive);
  assert.ok(finItems.some((i) => i.id === "movimentacoes"));
  assert.ok(finItems.some((i) => i.id === "importacoes"));
  assert.ok(finItems.some((i) => i.id === "relatorios"));

  const recItems = getItems("reconciliation", allActive);
  assert.ok(recItems.some((i) => i.id === "baixas"));

  const logItems = getItems("logistics", allActive);
  assert.ok(logItems.some((i) => i.id === "pedidos-ha"));
  assert.ok(logItems.some((i) => i.id === "canhotos"));

  const audItems = getItems("audit", allActive);
  assert.ok(audItems.some((i) => i.id === "torre-controle"));
});

test("GOV-05: Roteamento Direto Multi-Tenant: usuário com 1 única organização vinculada é direcionado sem tela intermediária", () => {
  const userOrganizations = [
    { id: "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76", display_name: "Hub do Açaí Distribuidora", slug: "hub_acai" }
  ];

  // Simulação da lógica de resolução de tenant
  function resolveTenant(orgs: typeof userOrganizations, paramId?: string, cookieId?: string, metaId?: string) {
    let sel = orgs.find((o) => o.id === paramId);
    if (!sel && cookieId) sel = orgs.find((o) => o.id === cookieId);
    if (!sel && metaId) sel = orgs.find((o) => o.id === metaId);
    if (!sel && orgs.length === 1) sel = orgs[0];
    if (!sel && orgs.length > 0) sel = orgs[0];
    return sel;
  }

  // Sem parâmetros, cookies ou metadata: resolve a única empresa do usuário diretamente
  const resolved = resolveTenant(userOrganizations);
  assert.ok(resolved);
  assert.equal(resolved.slug, "hub_acai");
  assert.equal(resolved.display_name, "Hub do Açaí Distribuidora");
});

test("GOV-06: Roteamento Direto Multi-Tenant: usuário recorrente com preferência em cookie/metadata é roteado com prioridade", () => {
  const userOrganizations = [
    { id: "0269fe05-0990-41a8-a28c-2919691eaf0f", display_name: "RSBUILD Engenharia e Holding", slug: "rsbuild" },
    { id: "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76", display_name: "Hub do Açaí Distribuidora", slug: "hub_acai" }
  ];

  function resolveTenant(orgs: typeof userOrganizations, paramId?: string, cookieId?: string, metaId?: string) {
    let sel = orgs.find((o) => o.id === paramId);
    if (!sel && cookieId) sel = orgs.find((o) => o.id === cookieId);
    if (!sel && metaId) sel = orgs.find((o) => o.id === metaId);
    if (!sel && orgs.length === 1) sel = orgs[0];
    if (!sel && orgs.length > 0) sel = orgs[0];
    return sel;
  }

  // Cookie aponta para Hub do Açaí
  const resolvedFromCookie = resolveTenant(userOrganizations, undefined, "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76");
  assert.equal(resolvedFromCookie?.slug, "hub_acai");

  // Metadata aponta para RSBUILD
  const resolvedFromMeta = resolveTenant(userOrganizations, undefined, undefined, "0269fe05-0990-41a8-a28c-2919691eaf0f");
  assert.equal(resolvedFromMeta?.slug, "rsbuild");

  // Parâmetro explícito na URL tem precedência absoluta sobre cookie
  const resolvedFromParam = resolveTenant(userOrganizations, "0269fe05-0990-41a8-a28c-2919691eaf0f", "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76");
  assert.equal(resolvedFromParam?.slug, "rsbuild");
});

test("GOV-07: Onboarding & Personalização: novos usuários sem onboarding_completed acionam personalização", () => {
  function shouldShowOnboarding(isOnboardingCompleted: boolean, isDevEmail: boolean, isForceSetup: boolean): boolean {
    return (!isOnboardingCompleted && !isDevEmail) || isForceSetup;
  }

  // Novo usuário comercial (Flávio / Vitor no 1º login)
  assert.equal(shouldShowOnboarding(false, false, false), true);

  // Usuário que já concluiu o onboarding no passado
  assert.equal(shouldShowOnboarding(true, false, false), false);

  // Desenvolvedor sem setup forçado entra direto
  assert.equal(shouldShowOnboarding(false, true, false), false);

  // Qualquer usuário (inclusive dev) com ?setup=true aciona a tela de personalização
  assert.equal(shouldShowOnboarding(true, true, true), true);
  assert.equal(shouldShowOnboarding(false, true, true), true);
});

