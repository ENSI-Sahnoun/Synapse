'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/supabase-clients/client'

type Room = { id: string; name: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  attendanceId: string
  studentName: string
}

export function PostCheckinSeatDialog({ open, onOpenChange, attendanceId, studentName }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('rooms')
      .select('id, name')
      .eq('status', 'open')
      .order('name')
      .then(({ data }) => {
        if (cancelled) return
        setRooms((data as Room[]) ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  function handleRoomSelect(room: Room) {
    onOpenChange(false)
    router.push(`/employee/rooms/${room.id}/map?attendanceId=${attendanceId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto
        max-sm:translate-x-0 max-sm:translate-y-0
        max-sm:rounded-t-2xl max-sm:rounded-b-none
        max-sm:max-w-none max-sm:w-full
        sm:max-w-sm
      ">
        <DialogHeader>
          <DialogTitle>Assigner une place — {studentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune salle ouverte.</p>
          ) : (
            <ul className="divide-y rounded-lg border overflow-hidden">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => handleRoomSelect(room)}
                  >
                    {room.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => onOpenChange(false)}>
            Passer — sans assigner de place
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
