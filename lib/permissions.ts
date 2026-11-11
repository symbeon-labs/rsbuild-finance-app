/**
 * RSBUILD OS — Matriz de Governança e Controle de Acesso (RBAC)
 * Níveis de Alçada para Multi-Tenant: RSBUILD, Diretoria e Operação
 * Conformidade com enum rsbuild_member_role e diretrizes periciais.
 */

export type MemberRole = "owner" | "admin" | "operator" | "viewer";

export interface RoleMetadata {
  role: MemberRole;
  label: string;
  badge: string;
  description: string;
  level: number; // 0 = Owner/Holding, 1 = Diretoria/Admin, 2 = Operação, 3 = Consulta
}

export const ROLE_HIERARCHY: Record<MemberRole, RoleMetadata> = {
  owner: {
    role: "owner",
    label: "Proprietário / Holding",
    badge: "👑 PROPRIETÁRIO",
    description: "Alçada irrestrita na plataforma. Gestão total de workspaces, convites e aprovações financeiras.",
    level: 0
  },
  admin: {
    role: "admin",
    label: "Diretoria / Gestão",
    badge: "🏛 DIRETORIA",
    description: "Diretoria e gerência da organização. Aprova baixas no ERP, conciliações com divergência e alçadas de crédito.",
    level: 1
  },
  operator: {
    role: "operator",
    label: "Operador de Chão de Fábrica / Vendas",
    badge: "⚡ OPERADOR",
    description: "Equipe operacional. Importa arquivos, sugere conciliações e registra canhotos. Sem permissão de baixa ou exclusão.",
    level: 2
  },
  viewer: {
    role: "viewer",
    label: "Auditoria / Consulta Externa",
    badge: "👁 CONSULTA",
    description: "Acesso somente-leitura para conferência contábil, fiscal e auditoria jurídica pericial.",
    level: 3
  }
};

/**
 * Normaliza qualquer string para um MemberRole canônico
 */
export function normalizeRole(role?: string | null): MemberRole {
  if (!role) return "viewer";
  const lower = role.toLowerCase().trim();
  if (lower === "owner") return "owner";
  if (lower === "admin") return "admin";
  if (lower === "operator") return "operator";
  return "viewer";
}

/**
 * Retorna os metadados de apresentação do papel
 */
export function getRoleMetadata(role?: string | null): RoleMetadata {
  const norm = normalizeRole(role);
  return ROLE_HIERARCHY[norm];
}

/**
 * Verifica se o usuário tem alçada de Diretoria/Gestão (Owner ou Admin)
 */
export function isExecutive(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === "owner" || norm === "admin";
}

/**
 * Verifica se o usuário pode gerar lote e aprovar baixas financeiras no ERP
 * REGRA RAQUEL: Apenas Diretoria/Admin pode gerar o arquivo de baixa oficial no Omie.
 */
export function canApproveBatchSettlement(role?: string | null): boolean {
  return isExecutive(role);
}

/**
 * Verifica se o usuário pode autorizar conciliação manual com divergência de valor
 */
export function canApproveDiscrepantMatch(role?: string | null): boolean {
  return isExecutive(role);
}

/**
 * Verifica se o usuário pode realizar conciliação manual
 * Operadores podem casar se os valores forem iguais. Viewers não podem casar.
 */
export function canPerformManualMatch(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === "owner" || norm === "admin" || norm === "operator";
}

/**
 * Verifica se o usuário pode cancelar ou excluir pedidos comerciais
 * REGRA RAQUEL: Vendedores e operadores não podem excluir pedidos para evitar manipulação de comissão/fraude.
 */
export function canDeleteOrCancelOrder(role?: string | null): boolean {
  return isExecutive(role);
}

/**
 * Verifica se o usuário pode confirmar importação de arquivos para o banco/sessão
 */
export function canConfirmImport(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm !== "viewer";
}

/**
 * Verifica se o usuário pode gerenciar integrantes e emitir convites
 */
export function canManageMembers(role?: string | null): boolean {
  return isExecutive(role);
}

/**
 * Zona de Sprints: restrita ao owner do tenant RSBUILD.
 * A autorização adicional de engenharia é resolvida no servidor.
 */
export function canAccessSprintZone(role?: string | null, orgSlug?: string | null): boolean {
  return normalizeRole(role) === "owner" && orgSlug === "rsbuild";
}


