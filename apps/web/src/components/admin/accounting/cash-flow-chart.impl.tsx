'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CashFlowPoint } from '@/data/admin/accounting'

type Props = { data: CashFlowPoint[] }

export function CashFlowChartImpl({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flux de trésorerie quotidien (revenus − dépenses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" DT" />
            <Tooltip
              formatter={(v: number) => `${v.toFixed(3)} DT`}
              labelFormatter={(l: string) => `Date: ${l}`}
            />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Line type="monotone" dataKey="net" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
