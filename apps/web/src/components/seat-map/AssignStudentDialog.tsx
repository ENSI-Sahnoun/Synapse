'use client'

import { useEffect, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserCircleDashed, Armchair, Clock } from '@phosphor-icons/react'
import { assignSeatAction, unoccupySeatAction, assignSeatToAttendanceAction, changeSeatAction, moveToDiversAction } from '@/actions/employee/attendance'
import { cancelReservation, acceptReservation } from '@/actions/employee/reservations'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase-clients/client'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Seat } from '@/data/admin/seat-map'

type RoomOption = { id: string; name: string }
type StudentResult = { id: string; full_name: string; phone: string | null }
type Occupant = { attendanceId: string; full_name: string | null; phone: string | null } | null
type Reservation = { id: string; expires_at: string; student: { full_name: string | null; phone: string | null } | null } | null

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
  attendanceId?: string
  /** Set when this pick is a "change seat" hand-off — the old seat to free once the new one is confirmed */
  fromSeatId?: string
}

export function AssignStudentDialog({ seat, open, onOpenChange, attendanceId, fromSeatId }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [occupant, setOccupant] = useState<Occupant>(null)
  const [reservation, setReservation] = useState<Reservation>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [pickingRoom, setPickingRoom] = useState(false)
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  const isOccupied = seat?.status === 'occupied'
  const isReserved = seat?.status === 'reserved'

  useEffect(() => {
    if (!open || !seat) { setOccupant(null); setReservation(null); return }

    let cancelled = false

    if (seat.status === 'occupied') {
      setLoadingInfo(true)
      const supabase = createClient()
      supabase
        .from('attendance')
        .select('id, profiles!attendance_student_id_fkey(full_name, phone)')
        .eq('seat_id', seat.id)
        .is('checked_out_at', null)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return
          const profile = data?.profiles as unknown as { full_name: string | null; phone: string | null } | null
          setOccupant(data ? { attendanceId: data.id, full_name: profile?.full_name ?? null, phone: profile?.phone ?? null } : null)
          setLoadingInfo(false)
        })
    } else if (seat.status === 'reserved') {
      setLoadingInfo(true)
      const supabase = createClient()
      supabase
        .from('reservations')
        .select('id, expires_at, profiles!reservations_student_id_fkey(full_name, phone)')
        .eq('seat_id', seat.id)
        .eq('status', 'active')
        .order('reserved_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return
          if (data) {
            const student = data.profiles as unknown as { full_name: string | null; phone: string | null } | null
            setReservation({ id: data.id, expires_at: data.expires_at, student })
          } else {
            setReservation(null)
          }
          setLoadingInfo(false)
        })
    }

    return () => {
      cancelled = true
    }
  }, [open, seat?.id, seat?.status])

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setPickingRoom(false) }
  }, [open])

  function openRoomPicker() {
    setPickingRoom(true)
    setLoadingRooms(true)
    const supabase = createClient()
    supabase
      .from('rooms')
      .select('id, name')
      .eq('status', 'open')
      .order('name')
      .then(({ data }) => {
        setRooms((data as RoomOption[]) ?? [])
        setLoadingRooms(false)
      })
  }

  function goChangeSeat(roomId: string) {
    if (!seat || !occupant) return
    onOpenChange(false)
    router.push(`/employee/rooms/${roomId}/map?attendanceId=${occupant.attendanceId}&fromSeatId=${seat.id}`)
  }

  const { execute: assign, status: assignStatus } = useAction(assignSeatAction, {
    onSuccess: () => { toast.success('Place assignée.'); onOpenChange(false) },
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'assignation"),
  })

  const { execute: assignToAttendance, status: assignToAttendanceStatus } = useAction(assignSeatToAttendanceAction, {
    onSuccess: () => {
      toast.success('Place assignée.')
      onOpenChange(false)
      router.replace(window.location.pathname) // strip ?attendanceId from URL
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'assignation"),
  })

  const { execute: unoccupy, status: unoccupyStatus } = useAction(unoccupySeatAction, {
    onSuccess: () => { toast.success('Place libérée.'); onOpenChange(false) },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la libération'),
  })

  const { execute: changeSeat, status: changeSeatStatus } = useAction(changeSeatAction, {
    onSuccess: () => {
      toast.success('Place changée.')
      onOpenChange(false)
      router.replace(window.location.pathname)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors du changement de place'),
  })

  const { execute: moveToDivers, status: moveToDiversStatus } = useAction(moveToDiversAction, {
    onSuccess: () => { toast.success('Étudiant déplacé vers Divers.'); onOpenChange(false) },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors du déplacement'),
  })

  const { execute: accept, status: acceptStatus } = useAction(acceptReservation, {
    onSuccess: () => { toast.success('Réservation confirmée.'); onOpenChange(false) },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la confirmation'),
  })

  const { execute: cancel, status: cancelStatus } = useAction(cancelReservation, {
    onSuccess: () => { toast.success('Réservation annulée.'); onOpenChange(false) },
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'annulation"),
  })

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      const supabase = createClient()
      const safe = query.replace(/[%,)]/g, '')
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'student')
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .limit(8)
      setResults((data as StudentResult[]) ?? [])
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const isPending = [assignStatus, unoccupyStatus, acceptStatus, cancelStatus, assignToAttendanceStatus, changeSeatStatus, moveToDiversStatus].includes('executing')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto
        max-sm:translate-x-0 max-sm:translate-y-0
        max-sm:rounded-t-2xl max-sm:rounded-b-none
        max-sm:max-w-none max-sm:w-full
        sm:max-w-md
      ">
        <DialogHeader>
          <DialogTitle>Place {seat?.label}</DialogTitle>
        </DialogHeader>

        {isOccupied ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center gap-3">
              <Armchair size={20} className="text-muted-foreground shrink-0" />
              <div className="min-w-0">
                {loadingInfo ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : occupant?.full_name ? (
                  <>
                    <p className="text-sm font-semibold truncate">{occupant.full_name}</p>
                    {occupant.phone && <p className="text-xs text-muted-foreground">{occupant.phone}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Occupant sans nom</p>
                )}
              </div>
            </div>

            {pickingRoom ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Choisir la salle de destination</p>
                {loadingRooms ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">Chargement…</p>
                ) : rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">Aucune salle ouverte.</p>
                ) : (
                  <ul className="divide-y rounded-lg border overflow-hidden max-h-56 overflow-y-auto">
                    {rooms.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer flex items-center justify-between"
                          onClick={() => goChangeSeat(r.id)}
                        >
                          {r.name}
                          {r.id === seat?.room_id && <span className="text-xs text-muted-foreground">salle actuelle</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setPickingRoom(false)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={openRoomPicker}
                  disabled={isPending || !occupant}
                >
                  Changer de place
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => seat && occupant && moveToDivers({ attendanceId: occupant.attendanceId, seat_id: seat.id, room_id: seat.room_id })}
                  disabled={isPending || !occupant}
                >
                  Déplacer vers Divers
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => seat && unoccupy({ seat_id: seat.id, room_id: seat.room_id })} disabled={isPending}>
                  Libérer la place (check-out)
                </Button>
              </>
            )}
          </div>

        ) : isReserved ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-amber-50 px-4 py-3 flex items-center gap-3">
              <Clock size={20} className="text-amber-500 shrink-0" />
              <div className="min-w-0">
                {loadingInfo ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : reservation ? (
                  <>
                    <p className="text-sm font-semibold truncate">
                      {reservation.student?.full_name ?? 'Sans nom'}
                    </p>
                    {reservation.student?.phone && (
                      <p className="text-xs text-muted-foreground">{reservation.student.phone}</p>
                    )}
                    <p className="text-xs text-amber-600 mt-0.5">
                      Expire {formatDistanceToNow(parseISO(reservation.expires_at), { addSuffix: true, locale: fr })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Réservation introuvable</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => reservation && accept({ reservationId: reservation.id })}
                disabled={isPending || !reservation}
              >
                Confirmer
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => reservation && cancel({ reservationId: reservation.id })}
                disabled={isPending || !reservation}
              >
                Annuler
              </Button>
            </div>
          </div>

        ) : (
          <div className="space-y-3">
            {attendanceId ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {fromSeatId
                    ? 'Changement de place — cliquez sur cette place pour la confirmer.'
                    : 'Assignation post-check-in — cliquez sur cette place pour la confirmer.'}
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!seat) return
                    if (fromSeatId) {
                      changeSeat({ attendanceId, fromSeatId, seat_id: seat.id, room_id: seat.room_id })
                    } else {
                      assignToAttendance({ attendanceId, seat_id: seat.id, room_id: seat.room_id })
                    }
                  }}
                  disabled={isPending}
                >
                  Confirmer — Place {seat?.label}
                </Button>
              </>
            ) : (
            <>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => seat && assign({ student_id: null, seat_id: seat.id, room_id: seat.room_id })}
              disabled={isPending}
            >
              <UserCircleDashed size={16} />
              Sans nom (place occupée)
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou rechercher</span>
              </div>
            </div>

            <Input
              placeholder="Nom ou téléphone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {isSearching && <p className="text-muted-foreground text-sm">Recherche…</p>}

            {results.length > 0 && (
              <ul className="divide-y rounded-md border max-h-48 overflow-y-auto">
                {results.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                      onClick={() => seat && assign({ student_id: student.id, seat_id: seat.id, room_id: seat.room_id })}
                      disabled={isPending}
                    >
                      <span className="font-medium">{student.full_name}</span>
                      {student.phone && <span className="text-muted-foreground">{student.phone}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {query.length >= 2 && !isSearching && results.length === 0 && (
              <p className="text-muted-foreground text-sm">Aucun étudiant trouvé.</p>
            )}
            </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
