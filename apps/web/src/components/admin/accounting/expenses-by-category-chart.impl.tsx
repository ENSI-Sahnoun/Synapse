'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExpenseByCategory } from '@/data/admin/accounting'

const COLORS = ['#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#22c55e', '#6366f1']

type Props = { data: ExpenseByCategory[] }

export function ExpensesByCategoryChartImpl({ data }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dépenses par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground">Aucune dépense sur la période</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toFixed(3)} DT`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2 text-right text-sm font-semibold">Total: {total.toFixed(3)} DT</p>
      </CardContent>
    </Card>
  )
}
