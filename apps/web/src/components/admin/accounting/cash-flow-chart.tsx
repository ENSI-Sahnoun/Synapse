'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { CashFlowPoint } from '@/data/admin/accounting'

// Code-splits recharts out of the initial bundle (see revenue-split-chart).
const Chart = dynamic(() => import('./cash-flow-chart.impl').then((m) => m.CashFlowChartImpl), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
})

export function CashFlowChart(props: { data: CashFlowPoint[] }) {
  return <Chart {...props} />
}
