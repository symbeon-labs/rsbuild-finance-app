import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEventInput {
  organizationId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Grava um evento em audit_events via service role.
 * Service role é necessário porque eventos de negação (access.denied)
 * são emitidos por usuários sem membership — o RLS de insert não os cobriria.
 * Nunca lança exceção: falha de auditoria não pode derrubar a operação.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_events").insert({
      organization_id: input.organizationId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.actorEmail ? { actorEmail: input.actorEmail } : {})
      }
    });
    if (error) {
      console.error(JSON.stringify({
        event: "audit_write_failed",
        organizationId: input.organizationId,
        eventType: input.eventType,
        code: error.code
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "audit_write_exception",
      organizationId: input.organizationId,
      eventType: input.eventType,
      error: err instanceof Error ? err.message : "unknown"
    }));
  }
}

/**
 * Registra session.login / session.logout em audit_events para cada
 * organização da qual o usuário é membro. Um evento por org mantém a
 * trilha visível no canal de auditoria do próprio tenant.
 */
export async function recordSessionEvent(input: {
  userId: string;
  userEmail?: string | null;
  eventType: "session.login" | "session.logout";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: memberships, error } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", input.userId);
    if (error) {
      console.error(JSON.stringify({
        event: "session_audit_membership_failed",
        userId: input.userId,
        code: error.code
      }));
      return;
    }
    for (const membership of memberships ?? []) {
      await recordAuditEvent({
        organizationId: membership.organization_id,
        actorId: input.userId,
        actorEmail: input.userEmail ?? null,
        eventType: input.eventType,
        entityType: "session",
        metadata: input.metadata ?? {}
      });
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "session_audit_exception",
      userId: input.userId,
      eventType: input.eventType,
      error: err instanceof Error ? err.message : "unknown"
    }));
  }
}
