import type { EnabledModulesConfig, ModuleType, NavSection } from "../app/types/workspace.js";

/** Returns the licensed capability required by a tenant route; null means shared workspace navigation. */
export function getRequiredModuleForSection(section: NavSection): ModuleType | null {
  if (section === "visao-geral" || section === "movimentacoes" || section === "operacoes-lote" || section === "importacoes" || section === "relatorios") return "finance";
  if (section === "conciliacao" || section === "baixas") return "reconciliation";
  if (section === "pedidos-ha" || section === "canhotos") return "logistics";
  if (section === "torre-controle" || section === "auditoria" || section === "agentes" || section === "acessos") return "audit";
  return null;
}

export function canAccessWorkspaceSection(section: NavSection, modules: EnabledModulesConfig): boolean {
  const required = getRequiredModuleForSection(section);
  return required === null || modules[required] === true;
}
