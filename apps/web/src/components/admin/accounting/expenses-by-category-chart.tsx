'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { ExpenseByCategory } from '@/data/admin/accounting'

// Code-splits recharts (~heavy) out of the admin dashboard's initial bundle.
// The chart is client-only and below the fold, so ssr:false + a skeleton is
// the right trade — first paint no longer waits on the charting engine.
const Chart = dynamic(() => import('./expenses-by-category-chart.impl').then((m) => m.ExpensesByCategoryChartImpl), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
})

export function ExpensesByCategoryChart(props: { data: ExpenseByCategory[] }) {
  return <Chart {...props} />
}
