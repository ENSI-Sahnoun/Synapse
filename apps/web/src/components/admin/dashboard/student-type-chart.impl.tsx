'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StudentTypePoint } from '@/data/admin/analytics/students'

type Props = { data: StudentTypePoint[] }

export function StudentTypeChartImpl({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveaux vs Récurrents (30 jours)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v.slice(5)}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(l: string) => `Date: ${l}`} />
            <Legend />
            <Bar dataKey="nouveaux" name="Nouveaux" fill="#6366f1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="recurrents" name="Récurrents" fill="#22c55e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
