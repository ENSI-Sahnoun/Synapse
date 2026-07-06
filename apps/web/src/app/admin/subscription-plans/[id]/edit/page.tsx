import { createSupabaseClient } from '@/supabase-clients/server'
import { notFound } from 'next/navigation'
import { EditPlanForm } from './EditPlanForm'
import Link from 'next/link'

export default async function EditSubscriptionPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseClient()
  const { data: plan, error } = await supabase
    .from('subscription_plans')
    .select('id, name, duration_days, price_dt, tax_rate_pct, is_active')
    .eq('id', id)
    .single()

  if (error || !plan) notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/subscription-plans" className="text-sm text-muted-foreground hover:underline">
        ← Formules
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {plan.name}</h1>
      <EditPlanForm plan={plan} />
    </div>
  )
}
