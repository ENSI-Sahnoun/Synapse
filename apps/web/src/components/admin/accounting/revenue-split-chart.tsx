'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { RevenueSplitPoint } from '@/data/admin/accounting'

// Code-splits recharts (~heavy) out of the admin dashboard's initial bundle.
// The chart is client-only and below the fold, so ssr:false + a skeleton is
// the right trade — first paint no longer waits on the charting engine.
const Chart = dynamic(() => import('./revenue-split-chart.impl').then((m) => m.RevenueSplitChartImpl), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
})

export function RevenueSplitChart(props: { data: RevenueSplitPoint[] }) {
  return <Chart {...props} />
}
