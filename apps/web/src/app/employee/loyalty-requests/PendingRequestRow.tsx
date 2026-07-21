'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { UserAvatar } from '@/components/user/UserAvatar'
import { RequestActions } from './request-actions'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

export interface PendingRequestRowData {
  id: string
  points_used: number
  created_at: string
  student: { id: string; full_name: string; phone: string | null; avatar_url: string | null } | null
  rule: { id: string; name: string; reward_type: string; reward_value: number } | null
}

export function PendingRequestRow({ request }: { request: PendingRequestRowData }) {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [flashId, setFlashId] = useState<string | null>(highlightId)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (highlightId !== request.id) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFlashId(null), 2500)
    return () => clearTimeout(t)
  }, [highlightId, request.id])

  const { student, rule } = request

  return (
    <div
      ref={ref}
      className="border rounded-lg p-4 flex items-start justify-between gap-4"
      style={{ background: flashId === request.id ? '#fef9c3' : undefined, transition: 'background 0.6s ease' }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <UserAvatar fullName={student?.full_name} avatarUrl={student?.avatar_url} className="h-8 w-8" />
          <p className="font-medium text-sm">{student?.full_name ?? 'Étudiant inconnu'}</p>
        </div>
        {student?.phone && (
          <p className="text-xs text-muted-foreground">{student.phone}</p>
        )}
        <p className="text-sm">
          <span className="font-medium">{rule?.name ?? 'Récompense'}</span>
          <span className="text-muted-foreground ml-2 text-xs">
            {REWARD_TYPE_LABELS[rule?.reward_type ?? ''] ?? rule?.reward_type}
            {rule?.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {request.points_used} pts · Demandé le{' '}
          {format(new Date(request.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
        </p>
      </div>
      <RequestActions requestId={request.id} />
    </div>
  )
}
