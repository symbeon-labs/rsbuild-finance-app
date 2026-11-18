/**
 * RSBUILD OS — Matriz de Governança e Controle de Acesso (RBAC)
 * Papéis organizacionais multi-tenant. Autoridade global da plataforma
 * é independente e está definida em lib/platform-authorization.ts.
 */
export type MemberRole = "owner" | "admin" | "operator" | "viewer";

export interface RoleMetadata {
  role: MemberRole;
  label: string;
  badge: string;
  description: string;
  level: number;
}

export const ROLE_HIERARCHY: Record<MemberRole, RoleMetadata> = {
  owner: {
    role: "owner",
    label: "Responsável pela organização",
    badge: "👑 PROPRIETÁRIO",
    description: "Administra a organização, seus membros, workspaces e aprovações permitidas. Não recebe privilégios globais da plataforma.",
    level: 0
  },
  admin: {
    role: "admin",
    label: "Diretoria / Gestão",
    badge: "🏛 DIRETORIA",
    description: "Gerencia a operação da organização e aprova ações financeiras dentro das alçadas configuradas.",
    level: 1
  },
  operator: {
    role: "operator",
    label: "Operação",
    badge: "⚡ OPERADOR",
    description: "Executa atividades operacionais habilitadas. Não administra membros nem concede capacidades.",
    level: 2
  },
  viewer: {
    role: "viewer",
    label: "Consulta",
    badge: "👁 CONSULTA",
    description: "Consulta informações autorizadas, sem permissão de alteração ou aprovação.",
    level: 3
  }
};

export function normalizeRole(role?: string | null): MemberRole {
  if (!role) return "viewer";
  const lower = role.toLowerCase().trim();
  if (lower === "owner") return "owner";
  if (lower === "admin") return "admin";
  if (lower === "operator") return "operator";
  return "viewer";
}

export function getRoleMetadata(role?: string | null): RoleMetadata {
  return ROLE_HIERARCHY[normalizeRole(role)];
}

export function isExecutive(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === "owner" || norm === "admin";
}

export function canApproveBatchSettlement(role?: string | null): boolean {
  return isExecutive(role);
}

export function canApproveDiscrepantMatch(role?: string | null): boolean {
  return isExecutive(role);
}

export function canPerformManualMatch(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === "owner" || norm === "admin" || norm === "operator";
}

export function canDeleteOrCancelOrder(role?: string | null): boolean {
  return isExecutive(role);
}

export function canConfirmImport(role?: string | null): boolean {
  return normalizeRole(role) !== "viewer";
}

export function canManageMembers(role?: string | null): boolean {
  return isExecutive(role);
}

/**
 * Acesso ao portfólio interno RSBUILD. Não é uma concessão de autoridade
 * de plataforma; privilégios de plataforma exigem platform_administrators.
 */
export function canAccessSprintZone(role?: string | null, orgSlug?: string | null): boolean {
  return normalizeRole(role) === "owner" && orgSlug === "rsbuild";
}
