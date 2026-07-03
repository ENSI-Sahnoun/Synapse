'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { checkoutAction } from '@/actions/checkin/checkout-action'
import { PostCheckinSeatDialog } from '@/components/checkin/PostCheckinSeatDialog'

interface UnassignedStudent {
  attendanceId: string
  studentName: string
}

export function UnassignedStudents({ students }: { students: UnassignedStudent[] }) {
  const router = useRouter()
  const [hidden, setHidden] = useState<string[]>([])
  const [assignTarget, setAssignTarget] = useState<UnassignedStudent | null>(null)

  const { execute: doCheckout } = useAction(checkoutAction, {
    onSuccess: ({ input }) => {
      toast.success('Sortie enregistrée')
      if (input) setHidden((prev) => [...prev, input.attendanceId])
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la sortie'),
  })

  const visible = students.filter((s) => !hidden.includes(s.attendanceId))
  if (visible.length === 0) return null

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid var(--synapse-orange-600, #ea580c)',
        borderRadius: 'var(--radius-xl)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Divers — sans salle assignée</div>
        <span
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--synapse-orange-600, #ea580c)',
            background: 'rgba(234,88,12,0.1)', borderRadius: 99, padding: '3px 10px',
          }}
        >
          {visible.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((s) => (
          <div
            key={s.attendanceId}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
              padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{s.studentName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setAssignTarget(s)}
                style={{
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
                  padding: '7px 12px', fontSize: 12, fontWeight: 600, background: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Assigner une place
              </button>
              <button
                onClick={() => doCheckout({ attendanceId: s.attendanceId })}
                style={{
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
                  padding: '7px 12px', fontSize: 12, fontWeight: 600, background: 'none', cursor: 'pointer',
                  color: 'var(--destructive)',
                }}
              >
                Sortie
              </button>
            </div>
          </div>
        ))}
      </div>

      {assignTarget && (
        <PostCheckinSeatDialog
          open={!!assignTarget}
          onOpenChange={(open) => !open && setAssignTarget(null)}
          attendanceId={assignTarget.attendanceId}
          studentName={assignTarget.studentName}
        />
      )}
    </div>
  )
}
