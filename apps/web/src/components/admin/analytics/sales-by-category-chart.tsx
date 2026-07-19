'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { CategorySales } from '@/data/admin/analytics/pos'

// Code-splits recharts (~heavy) out of the admin dashboard's initial bundle.
// The chart is client-only and below the fold, so ssr:false + a skeleton is
// the right trade — first paint no longer waits on the charting engine.
const Chart = dynamic(() => import('./sales-by-category-chart.impl').then((m) => m.SalesByCategoryChartImpl), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
})

export function SalesByCategoryChart(props: { data: CategorySales[] }) {
  return <Chart {...props} />
}
