import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_NAV_ITEMS,
  ORGANIZATION_PRESETS,
  orgHasExecutiveTower,
  OrganizationId
} from "../app/types/workspace.js";

test("GOV-01: orgHasExecutiveTower e Torre de Controle estão disponíveis para todos os workspaces", () => {
  assert.equal(orgHasExecutiveTower("hub_acai"), true, "Hub Açaí Salvador possui Torre de Controle");
  assert.equal(orgHasExecutiveTower("rsbuild"), true, "RSBUILD possui Torre de Controle");
  assert.equal(orgHasExecutiveTower("mundo_sabor"), true, "Mundo do Sabor possui Torre de Controle");
});

test("GOV-02: ORGANIZATION_PRESETS parametriza os 3 workspaces homologados com Torre de Controle ativa", () => {
  const rsbuild = ORGANIZATION_PRESETS.find((p) => p.id === "rsbuild");
  const hubAcai = ORGANIZATION_PRESETS.find((p) => p.id === "hub_acai");
  const mundoSabor = ORGANIZATION_PRESETS.find((p) => p.id === "mundo_sabor");

  assert.ok(rsbuild, "RSBUILD deve estar cadastrado");
  assert.ok(hubAcai, "Hub Açaí deve estar cadastrado");
  assert.ok(mundoSabor, "Mundo do Sabor deve estar cadastrado");

  // Torre de Controle ativa para todos os workspaces
  assert.equal(rsbuild.hasExecutiveTower, true, "RSBUILD tem Torre de Controle ativa");
  assert.equal(hubAcai.hasExecutiveTower, true, "Hub Açaí tem Torre de Controle ativa");
  assert.equal(mundoSabor.hasExecutiveTower, true, "Mundo do Sabor tem Torre de Controle ativa");

  // Módulos operacionais
  assert.equal(rsbuild.enabledModules.finance, true, "RSBUILD opera finanças");
  assert.equal(hubAcai.enabledModules.logistics, true, "Hub Açaí opera logística");
  assert.equal(mundoSabor.enabledModules.finance, true, "Mundo do Sabor opera finanças");
  assert.equal(mundoSabor.enabledModules.logistics, true, "Mundo do Sabor opera logística");
});

test("GOV-03: Filtragem de menu exibe Torre de Controle para todos os workspaces", () => {
  function getVisibleNavItems(orgId: OrganizationId, activeModule: "finance" | "logistics") {
    return ALL_NAV_ITEMS.filter((item) => {
      if (item.id === "torre-controle") {
        return orgHasExecutiveTower(orgId);
      }
      if (item.module === "all") return true;
      return item.module === activeModule;
    });
  }

  // RSBUILD: deve exibir torre-controle
  const rsNavFinance = getVisibleNavItems("rsbuild", "finance");
  assert.ok(rsNavFinance.some((i) => i.id === "torre-controle"), "RSBUILD deve exibir torre-controle");

  // Mundo do Sabor: deve exibir torre-controle
  const msNavFinance = getVisibleNavItems("mundo_sabor", "finance");
  assert.ok(msNavFinance.some((i) => i.id === "torre-controle"), "Mundo do Sabor deve exibir torre-controle");

  // Hub Açaí: deve exibir torre-controle
  const haNavLogistics = getVisibleNavItems("hub_acai", "logistics");
  assert.ok(haNavLogistics.some((i) => i.id === "torre-controle"), "Hub Açaí deve exibir torre-controle");
});
