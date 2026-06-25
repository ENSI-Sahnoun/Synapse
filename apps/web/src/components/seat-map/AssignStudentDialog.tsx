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
import { assignSeatAction } from '@/actions/employee/attendance'
import { createClient } from '@/supabase-clients/client'
import type { Seat } from '@/data/admin/seat-map'

type StudentResult = { id: string; full_name: string; phone: string | null }

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignStudentDialog({ seat, open, onOpenChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const { execute, status } = useAction(assignSeatAction, {
    onSuccess: () => {
      toast.success('Étudiant assigné à la place')
      onOpenChange(false)
      setQuery('')
      setResults([])
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erreur lors de l'assignation")
    },
  })

  // Debounced student search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'student')
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(8)

      setResults((data as StudentResult[]) ?? [])
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  function handleAssign(student: StudentResult) {
    if (!seat) return
    execute({
      student_id: student.id,
      seat_id: seat.id,
      room_id: seat.room_id,
    })
  }

  const isPending = status === 'executing'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assigner un étudiant — Place {seat?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Rechercher par nom ou téléphone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {isSearching && (
            <p className="text-muted-foreground text-sm">Recherche…</p>
          )}

          {results.length > 0 && (
            <ul className="divide-y rounded-md border">
              {results.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                    onClick={() => handleAssign(student)}
                    disabled={isPending}
                  >
                    <span className="font-medium">{student.full_name}</span>
                    {student.phone && (
                      <span className="text-muted-foreground">{student.phone}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length >= 2 && !isSearching && results.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun étudiant trouvé.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
