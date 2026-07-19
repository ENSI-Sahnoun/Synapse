'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { RevenuePoint } from '@/data/admin/analytics/overview'

// Code-splits recharts (~heavy) out of the admin dashboard's initial bundle.
// The chart is client-only and below the fold, so ssr:false + a skeleton is
// the right trade — first paint no longer waits on the charting engine.
const Chart = dynamic(() => import('./revenue-chart.impl').then((m) => m.RevenueChartImpl), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
})

export function RevenueChart(props: { data: RevenuePoint[] }) {
  return <Chart {...props} />
}
