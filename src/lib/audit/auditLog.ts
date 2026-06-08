import { requireSupabase } from '../supabase/client';

export interface AuditEventInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(input: AuditEventInput) {
  const client = requireSupabase();
  const result = await (client as unknown as {
    rpc: (
      name: 'record_audit_event',
      args: {
        p_action: string;
        p_entity_type: string;
        p_entity_id: string | null;
        p_metadata: Record<string, unknown>;
      }
    ) => Promise<{ data: string | null; error: Error | null }>;
  }).rpc('record_audit_event', {
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (result.error) {
    throw result.error;
  }

  return result.data as string;
}
