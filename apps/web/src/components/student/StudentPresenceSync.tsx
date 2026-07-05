'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase-clients/client'

// Keeps the student dashboard live: any change to THIS student's attendance
// (they get scanned in at the kiosk, an employee assigns their seat, they get
// checked out) re-runs the server component so the "Divers" seat prompt and
// presence banner appear/update instantly — no manual refresh.
export function StudentPresenceSync({ studentId }: { studentId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const topic = `realtime:student-presence-${studentId}`

    // Guard against a stale channel from a prior mount (StrictMode/fast nav).
    const stale = supabase.getChannels().find((c) => c.topic === topic)
    if (stale) supabase.removeChannel(stale)

    const channel = supabase
      .channel(`student-presence-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `student_id=eq.${studentId}`,
        },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [studentId, router])

  return null
}
