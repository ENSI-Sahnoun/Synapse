import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getPnl } from '@/data/admin/accounting'
import { buildPnlWorkbook } from '@/lib/exports/pnl-excel'
import { createSupabaseClient } from '@/supabase-clients/server'

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to)
    return NextResponse.json({ error: 'Paramètres from et to requis' }, { status: 400 })

  const pnl = await getPnl({ from, to })
  const wb = buildPnlWorkbook(pnl, from, to)
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `synapse-pnl-${from}-${to}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
