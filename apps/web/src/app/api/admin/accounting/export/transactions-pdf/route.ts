import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getTransactions } from '@/data/admin/accounting'
import { TransactionsPdfDocument } from '@/lib/exports/transactions-pdf'
import { createSupabaseClient } from '@/supabase-clients/server'
import { issueExportToken } from '@/lib/exports/export-token'
import React from 'react'

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

  const transactions = await getTransactions({ from, to })
  const buffer = await renderToBuffer(
    React.createElement(TransactionsPdfDocument, { transactions, from, to }) as any,
  )

  const filename = `synapse-transactions-${from}-${to}.pdf`
  const token = issueExportToken('financials', from, to, user.id)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Export-Token': token,
    },
  })
}
