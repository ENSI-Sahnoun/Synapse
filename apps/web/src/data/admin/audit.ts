import { createSupabaseClient } from '@/supabase-clients/server'
import { tunisRange } from '@/lib/tz'

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE'

/** A row snapshot as stored in `financial_audit_log.before_data` / `after_data`. */
export type AuditRecord = Record<string, unknown> | null

export type AuditLogRow = {
  id: string
  tableName: string
  recordId: string
  operation: AuditOperation
  actorId: string | null
  actorName: string
  actorRole: string | null
  beforeData: AuditRecord
  afterData: AuditRecord
  createdAt: string
}

export type FieldChange = { field: string; before: unknown; after: unknown }

// Rewritten by triggers on every write, so it changes on 100% of updates and
// tells the reader nothing about what the actor actually did.
const NOISE_FIELDS = new Set(['updated_at'])

function isScalar(v: unknown): v is string | number {
  return typeof v === 'string' || typeof v === 'number'
}

/**
 * Fields that differ between two row snapshots, so the UI can render
 * "montant: 50.000 → 75.000" instead of two blobs of JSON the owner has to
 * diff by eye.
 *
 * Inserts (no `before`) and deletes (no `after`) come back as changes against
 * `null`, which is what they are.
 */
export function summariseChange(before: AuditRecord, after: AuditRecord): FieldChange[] {
  const fields: string[] = []
  for (const key of Object.keys(after ?? {})) {
    if (!NOISE_FIELDS.has(key)) fields.push(key)
  }
  for (const key of Object.keys(before ?? {})) {
    if (!NOISE_FIELDS.has(key) && !fields.includes(key)) fields.push(key)
  }

  const changes: FieldChange[] = []
  for (const field of fields) {
    const b = before?.[field] ?? null
    const a = after?.[field] ?? null
    // Structural comparison, because jsonb values may be objects or arrays.
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    // `numeric` columns arrive as strings and integers as numbers, so 50 and
    // '50' for the same column are not a change the owner cares about.
    if (isScalar(b) && isScalar(a) && String(b) === String(a)) continue
    changes.push({ field, before: b, after: a })
  }
  return changes
}

type AuditSelectRow = {
  id: string
  table_name: string
  record_id: string
  operation: AuditOperation
  actor_id: string | null
  actor_role: string | null
  before_data: AuditRecord
  after_data: AuditRecord
  created_at: string
  actor: { full_name: string | null } | null
}

type AuditQuery = {
  select: (columns: string) => AuditQuery
  eq: (col: string, value: string) => AuditQuery
  gte: (col: string, value: string) => AuditQuery
  lt: (col: string, value: string) => AuditQuery
  order: (col: string, opts: { ascending: boolean }) => AuditQuery
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: AuditSelectRow[] | null; error: { message: string } | null }>
}

/**
 * Read-only view of the financial journal.
 *
 * `financial_audit_log` has no INSERT/UPDATE/DELETE policy for any role by
 * design — only the SECURITY DEFINER trigger can append to it. Never add a
 * mutation here: a journal its own users can edit is not a journal.
 */
export async function getFinancialAuditLog(filters: {
  from: string
  to: string
  tableName?: string
  limit?: number
  offset?: number
}): Promise<AuditLogRow[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(filters.from, filters.to)
  const limit = filters.limit ?? 200
  const offset = filters.offset ?? 0

  let query = (supabase.from as unknown as (table: string) => AuditQuery)('financial_audit_log')
    .select(
      `id, table_name, record_id, operation, actor_id, actor_role,
       before_data, after_data, created_at,
       actor:profiles!financial_audit_log_actor_id_fkey(full_name)`,
    )
    .gte('created_at', start)
    .lt('created_at', endExclusive)

  if (filters.tableName) query = query.eq('table_name', filters.tableName)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id,
    tableName: r.table_name,
    recordId: r.record_id,
    operation: r.operation,
    actorId: r.actor_id,
    // pg_cron writes (recurring expenses, payroll) have no auth.uid(), so a
    // null actor means the job did it, not that the actor is unknown.
    actorName: r.actor?.full_name ?? 'Système',
    actorRole: r.actor_role,
    beforeData: r.before_data,
    afterData: r.after_data,
    createdAt: r.created_at,
  }))
}
