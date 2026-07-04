'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RevenuePoint } from '@/data/admin/analytics/overview'

type Props = { data: RevenuePoint[] }

export function RevenueChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus (30 derniers jours)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v.slice(5)} // MM-DD
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} unit=" DT" />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)} DT`, 'Revenus']}
              labelFormatter={(l: string) => `Date: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
