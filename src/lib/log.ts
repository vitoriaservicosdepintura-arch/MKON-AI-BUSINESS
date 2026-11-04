import { supabase } from './supabase'

/** Regista uma ação do administrador. As tabelas críticas também são auditadas por triggers no banco. */
export async function logActivity(action: string, entityType?: string, entityId?: string, details: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getUser()
  await supabase.from('activity_logs').insert({
    actor_id: data.user?.id ?? null, action, entity_type: entityType ?? null, entity_id: entityId ?? null, details,
  })
}
