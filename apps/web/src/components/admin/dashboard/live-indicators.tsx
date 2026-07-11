'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/supabase-clients/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LiveSnapshot } from '@/data/admin/analytics/overview'

type Props = {
  initial: LiveSnapshot
}

export function LiveIndicators({ initial }: Props) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(initial)

  useEffect(() => {
    const supabase = createClient()

    // ponytail: guard against stale channel from a prior mount (StrictMode/fast nav)
    // still being torn down when this effect re-creates the same topic.
    const stale = supabase.getChannels().find((c) => c.topic === 'realtime:dashboard-live')
    if (stale) supabase.removeChannel(stale)

    // Re-fetch live snapshot on any relevant change
    async function refresh() {
      // Fetch updated counts from API route to avoid RLS issues in browser client
      const res = await fetch('/api/admin/dashboard/snapshot')
      if (res.ok) {
        const data = await res.json()
        setSnapshot(data)
      }
    }

    const channel = supabase
      .channel('dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'purchases' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'subscriptions' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lockers' },
        refresh,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const occupancyPct =
    snapshot.seatOccupancy.total > 0
      ? Math.round((snapshot.seatOccupancy.occupied / snapshot.seatOccupancy.total) * 100)
      : 0

  const lockerOccupancyPct =
    snapshot.lockerOccupancy.total > 0
      ? Math.round((snapshot.lockerOccupancy.occupied / snapshot.lockerOccupancy.total) * 100)
      : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Étudiants présents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{snapshot.studentsInside}</p>
          <Badge variant="outline" className="mt-1">
            En direct
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Occupation des places
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {snapshot.seatOccupancy.occupied}/{snapshot.seatOccupancy.total}
          </p>
          <p className="text-sm text-muted-foreground">{occupancyPct}% occupé</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Casiers occupés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {snapshot.lockerOccupancy.occupied}/{snapshot.lockerOccupancy.total}
          </p>
          <p className="text-sm text-muted-foreground">{lockerOccupancyPct}% occupé</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenus du jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{snapshot.todayRevenue.toFixed(2)} DT</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Abonnements expirant cette semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{snapshot.expiringSoonCount}</p>
          {snapshot.expiringSoonCount > 0 && (
            <Badge variant="destructive" className="mt-1">
              Attention
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
