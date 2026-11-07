import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_NAV_ITEMS,
  ORGANIZATION_PRESETS,
  orgHasExecutiveTower,
  OrganizationId
} from "../app/types/workspace.js";

test("GOV-01: orgHasExecutiveTower restringe Torre de Controle estritamente ao Hub Açaí Salvador", () => {
  assert.equal(orgHasExecutiveTower("hub_acai"), true, "Hub Açaí Salvador deve ter Torre de Controle");
  assert.equal(orgHasExecutiveTower("rsbuild"), false, "RSBUILD não deve ter Torre de Controle / Diretoria");
  assert.equal(orgHasExecutiveTower("mundo_sabor"), false, "Mundo do Sabor não deve ter Torre de Controle / Diretoria");
  assert.equal(orgHasExecutiveTower(undefined), false, "Organização indefinida não deve ter Torre de Controle");
});

test("GOV-02: ORGANIZATION_PRESETS parametriza os 3 workspaces homologados com governança correta", () => {
  const rsbuild = ORGANIZATION_PRESETS.find((p) => p.id === "rsbuild");
  const hubAcai = ORGANIZATION_PRESETS.find((p) => p.id === "hub_acai");
  const mundoSabor = ORGANIZATION_PRESETS.find((p) => p.id === "mundo_sabor");

  assert.ok(rsbuild, "RSBUILD deve estar cadastrado");
  assert.ok(hubAcai, "Hub Açaí deve estar cadastrado");
  assert.ok(mundoSabor, "Mundo do Sabor deve estar cadastrado");

  // Regra do Usuário: Não tem diretoria no RSBUILD nem no Mundo do Sabor
  assert.equal(rsbuild.hasExecutiveTower, false, "RSBUILD não tem módulo de diretoria");
  assert.equal(mundoSabor.hasExecutiveTower, false, "Mundo do Sabor não tem módulo de diretoria");
  assert.equal(hubAcai.hasExecutiveTower, true, "Apenas Hub Açaí possui a Torre de Controle operacional");

  // Módulos operacionais
  assert.equal(rsbuild.enabledModules.finance, true, "RSBUILD opera finanças");
  assert.equal(hubAcai.enabledModules.logistics, true, "Hub Açaí opera logística");
  assert.equal(mundoSabor.enabledModules.finance, true, "Mundo do Sabor opera finanças");
  assert.equal(mundoSabor.enabledModules.logistics, true, "Mundo do Sabor opera logística");
});

test("GOV-03: Filtragem de menu oculta Torre de Controle para RSBUILD e Mundo do Sabor", () => {
  function getVisibleNavItems(orgId: OrganizationId, activeModule: "finance" | "logistics") {
    return ALL_NAV_ITEMS.filter((item) => {
      if (item.id === "torre-controle") {
        return orgHasExecutiveTower(orgId);
      }
      if (item.module === "all") return true;
      return item.module === activeModule;
    });
  }

  // RSBUILD: em Finanças e Logística nunca deve exibir torre-controle
  const rsNavFinance = getVisibleNavItems("rsbuild", "finance");
  assert.ok(!rsNavFinance.some((i) => i.id === "torre-controle"), "RSBUILD não pode exibir torre-controle");

  // Mundo do Sabor: em Finanças e Logística nunca deve exibir torre-controle
  const msNavFinance = getVisibleNavItems("mundo_sabor", "finance");
  assert.ok(!msNavFinance.some((i) => i.id === "torre-controle"), "Mundo do Sabor não pode exibir torre-controle");

  // Hub Açaí: deve exibir torre-controle
  const haNavLogistics = getVisibleNavItems("hub_acai", "logistics");
  assert.ok(haNavLogistics.some((i) => i.id === "torre-controle"), "Hub Açaí deve exibir torre-controle");
});

