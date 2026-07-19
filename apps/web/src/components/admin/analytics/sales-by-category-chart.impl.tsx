'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategorySales } from '@/data/admin/analytics/pos'

type Props = { data: CategorySales[] }

export function SalesByCategoryChartImpl({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventes par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" DT" />
            <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip formatter={(v: number) => `${v.toFixed(3)} DT`} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
