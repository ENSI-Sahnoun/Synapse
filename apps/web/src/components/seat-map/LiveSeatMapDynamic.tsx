'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { LiveSeatMapProps } from './LiveSeatMap'

/**
 * Code-splits react-konva (a heavy canvas engine) out of the initial route
 * bundle. LiveSeatMap is client-only (ssr:false) and canvas rendering can't
 * run on the server anyway, so nothing is lost — the student PWA and employee
 * map pages no longer pay the Konva download before first paint.
 */
export const LiveSeatMap = dynamic<LiveSeatMapProps>(
  () => import('./LiveSeatMap').then((m) => m.LiveSeatMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-xl" />,
  },
)
