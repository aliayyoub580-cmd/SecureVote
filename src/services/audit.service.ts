import { getClientAuditContext } from '@/lib/audit-client-context'
import { inferAuditCategory } from '@/lib/audit-taxonomy'
import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database'

type Row = Database['public']['Tables']['audit_logs']['Row']

export type AdminAuditListParams = {
  limit?: number
  offset?: number
  category?: string | null
  actionPrefix?: string | null
  actorId?: string | null
  resourceType?: string | null
  search?: string | null
  from?: string | null
  to?: string | null
}

export const auditService = {
  async list(limit = 200): Promise<Row[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async listAdminPaged(params: AdminAuditListParams): Promise<{ rows: Row[]; total: number }> {
    const { data, error } = await supabase.rpc('admin_list_audit_logs', {
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
      p_category: params.category?.trim() || null,
      p_action_prefix: params.actionPrefix?.trim() || null,
      p_actor_id: /^[0-9a-f-]{36}$/i.test(params.actorId?.trim() ?? '') ? params.actorId!.trim() : null,
      p_resource_type: params.resourceType?.trim() || null,
      p_search: params.search?.trim() || null,
      p_from: params.from || null,
      p_to: params.to || null,
    })
    if (error) throw error
    const raw = data as { total?: number; rows?: unknown } | null
    const total = Number(raw?.total ?? 0)
    const rows = Array.isArray(raw?.rows) ? (raw!.rows as Row[]) : []
    return { rows, total }
  },

  /**
   * Records an auditable event. Prefer `enrichClient: true` for auth and security-sensitive paths
   * to attach best-effort IP / device metadata.
   */
  async log(
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown> = {},
    options?: { enrichClient?: boolean },
  ) {
    const category = inferAuditCategory(action)
    let ip = ''
    let userAgent = ''
    let deviceLabel = ''
    if (options?.enrichClient) {
      try {
        const ctx = await getClientAuditContext()
        ip = ctx.ip ?? ''
        userAgent = ctx.userAgent
        deviceLabel = ctx.deviceLabel
      } catch {
        /* ignore */
      }
    }

    const validResourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId ?? '')
      ? resourceId
      : null

    const { error } = await supabase.rpc('record_audit_event', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: validResourceId,
      p_metadata: metadata as Json,
      p_ip: ip,
      p_user_agent: userAgent,
      p_device_label: deviceLabel,
      p_category: category,
    })

    if (error) {
      const { data: userRes } = await supabase.auth.getUser()
      const actorId = userRes.user?.id ?? null
      const base = {
        actor_id: actorId,
        action,
        resource_type: resourceType,
        resource_id: validResourceId,
        metadata: metadata as Json,
      }
      const extended = {
        ...base,
        ip_address: ip || null,
        user_agent: userAgent || null,
        device_label: deviceLabel || null,
        category,
      }
      const { error: e2 } = await supabase.from('audit_logs').insert(extended)
      if (e2) {
        const { error: e3 } = await supabase.from('audit_logs').insert(base)
        if (e3) {
          /* ignore non-critical client audit failures */
        }
      }
    }
  },
}
