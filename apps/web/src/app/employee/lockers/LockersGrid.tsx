'use client'

import { useState, useMemo } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  assignLockerAction,
  unassignLockerAction,
  markLockerUnavailableAction,
  markLockerAvailableAction,
} from '@/actions/employee/lockers'
import type { LockerRow } from '@/data/employee/lockers'

interface EligibleStudent {
  id: string
  full_name: string | null
  student_number: number | null
  phone: string | null
  is_eligible: boolean
}

interface Props {
  initialLockers: LockerRow[]
  eligibleStudents: EligibleStudent[]
}

const STATUS_STYLES: Record<LockerRow['status'], string> = {
  available: 'border-border bg-white hover:bg-muted',
  occupied: 'border-primary bg-primary/5',
  unavailable: 'border-border bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<LockerRow['status'], string> = {
  available: 'Libre',
  occupied: 'Occupé',
  unavailable: 'Indisponible',
}

export function LockersGrid({ initialLockers, eligibleStudents }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<LockerRow | null>(null)
  const [query, setQuery] = useState('')

  function closeAndRefresh() {
    setSelected(null)
    setQuery('')
    router.refresh()
  }

  const { execute: assign, status: assignStatus } = useAction(assignLockerAction, {
    onSuccess: () => { toast.success('Casier attribué'); closeAndRefresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  const { execute: unassign, status: unassignStatus } = useAction(unassignLockerAction, {
    onSuccess: () => { toast.success('Casier libéré'); closeAndRefresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  const { execute: markUnavailable, status: markUnavailableStatus } = useAction(markLockerUnavailableAction, {
    onSuccess: () => { toast.success('Casier marqué indisponible'); closeAndRefresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  const { execute: markAvailable, status: markAvailableStatus } = useAction(markLockerAvailableAction, {
    onSuccess: () => { toast.success('Casier remis en service'); closeAndRefresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const busy =
    assignStatus === 'executing' ||
    unassignStatus === 'executing' ||
    markUnavailableStatus === 'executing' ||
    markAvailableStatus === 'executing'

  const filteredStudents = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return eligibleStudents.filter(
      (s) => s.full_name?.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q),
    )
  }, [query, eligibleStudents])

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {initialLockers.map((locker) => (
          <button
            key={locker.id}
            type="button"
            onClick={() => { setSelected(locker); setQuery('') }}
            className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-colors ${STATUS_STYLES[locker.status]}`}
          >
            <span className="text-lg font-bold">{locker.number}</span>
            <span className="text-xs font-normal">{STATUS_LABEL[locker.status]}</span>
            {locker.status === 'occupied' && (
              <span className="text-xs truncate max-w-full px-1">{locker.student?.full_name}</span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Casier {selected?.number}</DialogTitle>
          </DialogHeader>

          {selected?.status === 'occupied' && (
            <div className="space-y-4">
              <p className="text-sm">
                Attribué à <span className="font-semibold">{selected.student?.full_name}</span>
              </p>
              <DialogFooter>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={busy}>
                      {unassignStatus === 'executing' ? 'Libération…' : 'Libérer le casier'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Libérer ce casier ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{selected.student?.full_name}</strong> perdra l&apos;accès au casier {selected.number}.
                        Les frais d&apos;attribution déjà payés ne sont pas remboursés. Cette action est manuelle et
                        ne se produit pas automatiquement avant l&apos;expiration de l&apos;abonnement.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => unassign({ locker_id: selected.id })}
                        disabled={busy}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Libérer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DialogFooter>
            </div>
          )}

          {selected?.status === 'unavailable' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Ce casier est marqué indisponible.</p>
              <DialogFooter>
                <Button disabled={busy} onClick={() => markAvailable({ locker_id: selected.id })}>
                  {markAvailableStatus === 'executing' ? 'Mise à jour…' : 'Remettre en service'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {selected?.status === 'available' && (
            <div className="space-y-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un étudiant éligible…"
                autoFocus
              />
              {query.trim() !== '' && (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucun étudiant éligible trouvé</p>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={busy || !s.is_eligible}
                        onClick={() => assign({ locker_id: selected.id, student_id: s.id })}
                        className={`w-full text-left border rounded-md p-2 text-sm disabled:cursor-not-allowed ${
                          s.is_eligible ? 'hover:bg-muted' : 'text-muted-foreground opacity-50'
                        }`}
                      >
                        <span className="font-medium">{s.full_name}</span>
                        {!s.is_eligible && <span className="text-xs"> (non éligible)</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" disabled={busy} onClick={() => markUnavailable({ locker_id: selected.id })}>
                  {markUnavailableStatus === 'executing' ? 'Mise à jour…' : 'Marquer indisponible'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
