import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRole,
  getRoleMetadata,
  isExecutive,
  canApproveBatchSettlement,
  canApproveDiscrepantMatch,
  canPerformManualMatch,
  canDeleteOrCancelOrder,
  canConfirmImport,
  canAccessSprintZone
} from "../lib/permissions";

test("RBAC: normalizeRole converte com segurança e adota 'viewer' como fallback", () => {
  assert.equal(normalizeRole("owner"), "owner");
  assert.equal(normalizeRole("OWNER"), "owner");
  assert.equal(normalizeRole("Admin"), "admin");
  assert.equal(normalizeRole("operator"), "operator");
  assert.equal(normalizeRole("VIEWER"), "viewer");
  assert.equal(normalizeRole(undefined), "viewer");
  assert.equal(normalizeRole(""), "viewer");
  assert.equal(normalizeRole("desconhecido"), "viewer");
});

test("RBAC: getRoleMetadata retorna informações visuais e níveis de alçada", () => {
  const ownerMeta = getRoleMetadata("owner");
  assert.equal(ownerMeta.level, 0);
  assert.ok(ownerMeta.badge.includes("PROPRIETÁRIO"));

  const adminMeta = getRoleMetadata("admin");
  assert.equal(adminMeta.level, 1);
  assert.ok(adminMeta.badge.includes("DIRETORIA"));

  const opMeta = getRoleMetadata("operator");
  assert.equal(opMeta.level, 2);
  assert.ok(opMeta.badge.includes("OPERADOR"));

  const viewMeta = getRoleMetadata("viewer");
  assert.equal(viewMeta.level, 3);
  assert.ok(viewMeta.badge.includes("CONSULTA"));
});

test("RBAC: isExecutive identifica perfis de Diretoria e Holding", () => {
  assert.equal(isExecutive("owner"), true);
  assert.equal(isExecutive("admin"), true);
  assert.equal(isExecutive("operator"), false);
  assert.equal(isExecutive("viewer"), false);
});

test("RBAC / Regra Raquel: canApproveBatchSettlement restringe baixas ERP a Diretoria", () => {
  assert.equal(canApproveBatchSettlement("owner"), true);
  assert.equal(canApproveBatchSettlement("admin"), true);
  assert.equal(canApproveBatchSettlement("operator"), false);
  assert.equal(canApproveBatchSettlement("viewer"), false);
});

test("RBAC / Regra Raquel: canDeleteOrCancelOrder impede operadores de excluir pedidos", () => {
  assert.equal(canDeleteOrCancelOrder("owner"), true);
  assert.equal(canDeleteOrCancelOrder("admin"), true);
  assert.equal(canDeleteOrCancelOrder("operator"), false);
  assert.equal(canDeleteOrCancelOrder("viewer"), false);
});

test("RBAC / Conciliação: canApproveDiscrepantMatch exige Diretoria para divergências", () => {
  assert.equal(canApproveDiscrepantMatch("owner"), true);
  assert.equal(canApproveDiscrepantMatch("admin"), true);
  assert.equal(canApproveDiscrepantMatch("operator"), false);
  assert.equal(canApproveDiscrepantMatch("viewer"), false);
});

test("RBAC / Conciliação: canPerformManualMatch autoriza operadores mas bloqueia viewers", () => {
  assert.equal(canPerformManualMatch("owner"), true);
  assert.equal(canPerformManualMatch("admin"), true);
  assert.equal(canPerformManualMatch("operator"), true);
  assert.equal(canPerformManualMatch("viewer"), false);
});

test("RBAC / Importações: canConfirmImport libera operadores mas bloqueia viewers", () => {
  assert.equal(canConfirmImport("owner"), true);
  assert.equal(canConfirmImport("operator"), true);
  assert.equal(canConfirmImport("viewer"), false);
});

test("RBAC / Governança: canAccessSprintZone restringe Torre de Sprints à RSBUILD", () => {
  assert.equal(canAccessSprintZone("owner", "rsbuild"), true);
  assert.equal(canAccessSprintZone("owner", "hub_acai"), false);
  assert.equal(canAccessSprintZone("admin", "rsbuild"), false);
  assert.equal(canAccessSprintZone("operator", "rsbuild"), false);
});

