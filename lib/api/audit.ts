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
