import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { startOfDay, startOfMonth } from 'date-fns'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ report: string }> }
) {
  const { report } = await params
  const admin = createSupabaseAdminClient()
  const todayISO = startOfDay(new Date()).toISOString()
  const monthISO = startOfMonth(new Date()).toISOString()

  let csv = ''
  let filename = 'export.csv'

  if (report === 'attendance') {
    filename = 'presences-du-jour.csv'
    const { data } = await admin
      .from('attendance')
      .select('checked_in_at, checked_out_at, profiles!attendance_student_id_fkey(full_name, phone)')
      .gte('checked_in_at', todayISO)
      .order('checked_in_at', { ascending: false })

    csv = 'Nom,Téléphone,Heure entrée,Heure sortie\n'
    for (const row of data ?? []) {
      const p = row.profiles as { full_name: string | null; phone: string | null } | null
      csv += `"${p?.full_name ?? ''}","${p?.phone ?? ''}","${row.checked_in_at}","${row.checked_out_at ?? ''}"\n`
    }
  } else if (report === 'members') {
    filename = 'membres-actifs.csv'
    const { data } = await admin
      .from('profiles')
      .select('full_name, phone, university, created_at')
      .eq('role', 'student')
      .eq('is_archived', false)

    csv = "Nom,Téléphone,Université,Inscription\n"
    for (const row of data ?? []) {
      csv += `"${row.full_name ?? ''}","${row.phone ?? ''}","${row.university ?? ''}","${row.created_at}"\n`
    }
  } else if (report === 'ledger') {
    filename = 'ledger-points.csv'
    const { data } = await admin
      .from('loyalty_ledger')
      .select('created_at, points_delta, reason, profiles!loyalty_ledger_student_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(1000)

    csv = 'Étudiant,Points,Raison,Date\n'
    for (const row of data ?? []) {
      const p = row.profiles as { full_name: string | null } | null
      csv += `"${p?.full_name ?? ''}","${row.points_delta}","${row.reason ?? ''}","${row.created_at}"\n`
    }
  } else if (report === 'sales') {
    filename = 'ventes-du-mois.csv'
    const { data } = await admin
      .from('purchases')
      .select('created_at, purchase_items(unit_price_dt, quantity, products(name))')
      .gte('created_at', monthISO)
      .order('created_at', { ascending: false })

    csv = 'Date,Produit,Qté,Prix unitaire DT\n'
    for (const purchase of data ?? []) {
      for (const item of (purchase.purchase_items ?? []) as { unit_price_dt: number; quantity: number; products: { name: string } | null }[]) {
        const productName = item.products?.name ?? ''
        csv += `"${purchase.created_at}","${productName}","${item.quantity}","${item.unit_price_dt}"\n`
      }
    }
  } else {
    return new NextResponse('Report not found', { status: 404 })
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
