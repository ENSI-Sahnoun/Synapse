'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LiveSnapshot } from '@/data/admin/analytics/overview'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// Crossfades a value when it changes instead of letting it snap — the only
// visible sign that "En direct" actually means something, since these numbers
// update from a realtime channel the user never directly triggers.
function LiveValue({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={String(children)}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6, position: 'absolute' }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className="inline-block"
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

function LiveDot() {
  return (
    <span className="relative flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
      <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
    </span>
  )
}

type Props = {
  initial: LiveSnapshot
  newStudents: number
  newStudentsDelta: number
}

export function LiveIndicators({ initial, newStudents, newStudentsDelta }: Props) {
  // Presentational only. Realtime freshness comes from the page-level
  // <LiveRefresher/> (router.refresh re-runs getLiveSnapshot and passes new
  // `initial`); this component used to run a SECOND overlapping subscription +
  // /api/admin/dashboard/snapshot fetch on the same tables, doubling server
  // load per check-in and racing the two updates. The LiveValue crossfade still
  // fires because `initial` changes on each server refresh.
  const snapshot: LiveSnapshot = initial

  const occupancyPct =
    snapshot.seatOccupancy.total > 0
      ? Math.round((snapshot.seatOccupancy.occupied / snapshot.seatOccupancy.total) * 100)
      : 0

  const lockerOccupancyPct =
    snapshot.lockerOccupancy.total > 0
      ? Math.round((snapshot.lockerOccupancy.occupied / snapshot.lockerOccupancy.total) * 100)
      : 0

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Étudiants présents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold"><LiveValue>{snapshot.studentsInside}</LiveValue></p>
          <Badge variant="outline" className="mt-1 gap-1.5">
            <LiveDot />
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
            <LiveValue>{`${snapshot.seatOccupancy.occupied}/${snapshot.seatOccupancy.total}`}</LiveValue>
          </p>
          <p className="text-sm text-muted-foreground"><LiveValue>{`${occupancyPct}% occupé`}</LiveValue></p>
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
            <LiveValue>{`${snapshot.lockerOccupancy.occupied}/${snapshot.lockerOccupancy.total}`}</LiveValue>
          </p>
          <p className="text-sm text-muted-foreground"><LiveValue>{`${lockerOccupancyPct}% occupé`}</LiveValue></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenus du jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold"><LiveValue>{`${snapshot.todayRevenue.toFixed(2)} DT`}</LiveValue></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Abonnements expirant cette semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold"><LiveValue>{snapshot.expiringSoonCount}</LiveValue></p>
          {snapshot.expiringSoonCount > 0 && (
            <Badge variant="destructive" className="mt-1">
              Attention
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Nouveaux étudiants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{newStudents}</p>
          {newStudentsDelta !== 0 && (
            <p className={`text-sm font-medium ${newStudentsDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {newStudentsDelta > 0 ? '▲' : '▼'} {Math.abs(newStudentsDelta)} vs période préc.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
