'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RevenueSplitPoint } from '@/data/admin/accounting'

type Props = { data: RevenueSplitPoint[] }

export function RevenueSplitChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus — abonnements vs boutique</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" DT" />
            <Tooltip
              formatter={(v: number) => `${v.toFixed(3)} DT`}
              labelFormatter={(l: string) => `Date: ${l}`}
            />
            <Legend />
            <Bar dataKey="subs" name="Abonnements" stackId="rev" fill="#6366f1" />
            <Bar dataKey="pos" name="Boutique" stackId="rev" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
