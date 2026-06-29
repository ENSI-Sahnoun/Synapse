import { createSupabaseClient } from '@/supabase-clients/server'
import type { AccountCategory } from '@/data/admin/accounting'

export async function getAllAccountCategories(): Promise<AccountCategory[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('account_categories')
    .select('*')
    .order('type')
    .order('name')
  return (data ?? []) as AccountCategory[]
}
