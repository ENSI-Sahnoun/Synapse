'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import {
  saveEmployeeAttendanceAction,
  deleteEmployeeAttendanceAction,
} from '@/actions/admin/employee-attendance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface AttendanceRow {
  id: string
  clock_in: string
  clock_out: string | null
  entry_method: string
  status: 'present' | 'late' | 'absent' | null // null when no schedule that day
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return ''
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

const STATUS_LABEL: Record<NonNullable<AttendanceRow['status']>, string> = {
  present: 'Présent',
  late: 'Retard',
  absent: 'Absence',
}
const STATUS_COLOR: Record<NonNullable<AttendanceRow['status']>, string> = {
  present: 'var(--synapse-green-500)',
  late: 'var(--synapse-orange-600, #ea580c)',
  absent: 'var(--destructive)',
}

function Row({ row, employeeId }: { row: AttendanceRow; employeeId: string }) {
  const [editing, setEditing] = useState(false)
  const [clockIn, setClockIn] = useState(toLocalInputValue(row.clock_in))
  const [clockOut, setClockOut] = useState(toLocalInputValue(row.clock_out))

  const { execute: save, status: saveStatus } = useAction(saveEmployeeAttendanceAction, {
    onSuccess: () => {
      toast.success('Pointage mis à jour')
      setEditing(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  const { execute: remove } = useAction(deleteEmployeeAttendanceAction, {
    onSuccess: () => toast.success('Pointage supprimé'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Input type="datetime-local" className="w-48" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        <span className="text-sm text-muted-foreground">→</span>
        <Input type="datetime-local" className="w-48" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        <Button
          size="sm"
          disabled={saveStatus === 'executing'}
          onClick={() =>
            save({
              id: row.id,
              employee_id: employeeId,
              clock_in: new Date(clockIn).toISOString(),
              clock_out: clockOut ? new Date(clockOut).toISOString() : null,
            })
          }
        >
          Sauvegarder
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="text-sm">
        {format(parseISO(row.clock_in), 'dd/MM/yyyy HH:mm')}
        {row.clock_out && ` → ${format(parseISO(row.clock_out), 'HH:mm')}`}
        {row.status && (
          <span
            className="ml-3 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--synapse-cream-100)', color: STATUS_COLOR[row.status] }}
          >
            {STATUS_LABEL[row.status]}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Modifier
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => remove({ id: row.id, employee_id: employeeId })}
        >
          Supprimer
        </Button>
      </div>
    </div>
  )
}

export function EmployeeAttendanceTable({ employeeId, rows }: { employeeId: string; rows: AttendanceRow[] }) {
  const [creating, setCreating] = useState(false)
  const [newIn, setNewIn] = useState('')
  const [newOut, setNewOut] = useState('')

  const { execute: save, status: saveStatus } = useAction(saveEmployeeAttendanceAction, {
    onSuccess: () => {
      toast.success('Pointage ajouté')
      setCreating(false)
      setNewIn('')
      setNewOut('')
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
      {rows.length === 0 && !creating && (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun pointage</p>
      )}
      {rows.map((row) => (
        <Row key={row.id} row={row} employeeId={employeeId} />
      ))}

      {creating ? (
        <div className="flex items-center gap-2 px-4 py-2">
          <Input type="datetime-local" className="w-48" value={newIn} onChange={(e) => setNewIn(e.target.value)} />
          <span className="text-sm text-muted-foreground">→</span>
          <Input type="datetime-local" className="w-48" value={newOut} onChange={(e) => setNewOut(e.target.value)} />
          <Button
            size="sm"
            disabled={!newIn || saveStatus === 'executing'}
            onClick={() =>
              save({
                employee_id: employeeId,
                clock_in: new Date(newIn).toISOString(),
                clock_out: newOut ? new Date(newOut).toISOString() : null,
              })
            }
          >
            Ajouter
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreating(false)}>
            Annuler
          </Button>
        </div>
      ) : (
        <div className="px-4 py-2">
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            + Ajouter un pointage manquant
          </Button>
        </div>
      )}
    </div>
  )
}
