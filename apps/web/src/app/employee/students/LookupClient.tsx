'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { checkinAction } from '@/actions/checkin/checkin-action'
import { checkoutAction } from '@/actions/checkin/checkout-action'
import { getStudentDetailAction } from '@/actions/employee/students'
import Link from 'next/link'
import { toast } from 'sonner'

interface Student {
  id: string
  full_name: string | null
  phone: string | null
  university: string | null
  qr_token: string | null
  student_number: number | null
}

interface CurrentlyIn {
  studentId: string
  attendanceId: string
  roomName: string
}

interface LookupClientProps {
  students: Student[]
  currentlyIn: CurrentlyIn[]
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: 'var(--accent-brand)',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {getInitials(name)}
    </div>
  )
}

function StudentCard({
  student,
  subtitle,
  onClick,
}: {
  student: Student
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <Avatar name={student.full_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {student.full_name ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{subtitle}</div>
      </div>
      <CaretRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </button>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-tertiary)',
        marginBottom: 8,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  )
}

interface DetailStats {
  planName: string | null
  endDate: string | null
  loyaltyPoints: number
  totalVisits: number
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--synapse-green-50, #f0faf4)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--synapse-green-500, #22c55e)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function DetailView({
  student,
  attendance,
  onBack,
  onCheckin,
  onCheckout,
}: {
  student: Student
  attendance: CurrentlyIn | null
  onBack: () => void
  onCheckin: (studentId: string) => void
  onCheckout: (studentId: string) => void
}) {
  const [stats, setStats] = useState<DetailStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const { execute: fetchDetail } = useAction(getStudentDetailAction, {
    onSuccess: ({ data }) => {
      if (data) {
        setStats({
          planName: data.planName,
          endDate: data.endDate,
          loyaltyPoints: data.loyaltyPoints,
          totalVisits: data.totalVisits,
        })
      }
      setStatsLoading(false)
    },
    onError: () => setStatsLoading(false),
  })

  useEffect(() => {
    setStatsLoading(true)
    fetchDetail({ studentId: student.id })
  }, [student.id])

  const { execute: doCheckin, isPending: checkinPending } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (data && data.status === 'AUTHORIZED') {
        onCheckin(student.id)
        toast.success('Entrée enregistrée')
      } else if (data) {
        const messages: Record<string, string> = {
          ALREADY_IN: 'Étudiant déjà présent',
          DENIED_EXPIRED: 'Abonnement expiré',
          DENIED_NO_SUB: 'Aucun abonnement actif',
          DENIED_UNKNOWN: 'Étudiant non reconnu',
          DENIED_NO_RESERVATION: 'Réservation requise',
        }
        toast.error(messages[data.status] ?? 'Accès refusé')
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de l\'enregistrement')
    },
  })

  const { execute: doCheckout, isPending: checkoutPending } = useAction(checkoutAction, {
    onSuccess: () => {
      onCheckout(student.id)
      toast.success('Sortie enregistrée')
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la sortie')
    },
  })

  const isPresent = !!attendance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--accent-brand)',
          fontWeight: 600,
          fontSize: 14,
          padding: 0,
        }}
      >
        <CaretLeft size={16} />
        Retour
      </button>

      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Avatar name={student.full_name} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-secondary)' }}>{student.full_name ?? '—'}</div>
          {student.university && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{student.university}</div>
          )}
        </div>
        {isPresent && (
          <span
            style={{
              background: 'var(--synapse-green-50, #f0faf4)',
              color: 'var(--synapse-green-500, #22c55e)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Présent
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <StatTile label="Plan" value={statsLoading ? '…' : (stats?.planName ?? '—')} />
        <StatTile label="Points" value={statsLoading ? '…' : (stats?.loyaltyPoints ?? 0)} />
        <StatTile label="Visites" value={statsLoading ? '…' : (stats?.totalVisits ?? 0)} />
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {[
          { label: 'Abonnement', value: stats?.endDate ? `Expire le ${new Date(stats.endDate).toLocaleDateString('fr-FR')}` : '—' },
          isPresent ? { label: 'Salle', value: attendance!.roomName } : null,
          { label: 'Total visites', value: stats ? String(stats.totalVisits) : '—' },
          { label: 'Points fidélité', value: stats ? String(stats.loyaltyPoints) : '—' },
          student.phone ? { label: 'Téléphone', value: student.phone } : null,
        ].filter(Boolean).map((row, i, arr) => (
          <div
            key={row!.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{row!.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{row!.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isPresent ? (
          <button
            onClick={() => doCheckout({ attendanceId: attendance!.attendanceId })}
            disabled={checkoutPending}
            style={{
              background: 'var(--accent-brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '13px',
              fontWeight: 700,
              fontSize: 14,
              cursor: checkoutPending ? 'not-allowed' : 'pointer',
              opacity: checkoutPending ? 0.7 : 1,
            }}
          >
            {checkoutPending ? 'En cours…' : 'Enregistrer sortie'}
          </button>
        ) : (
          <button
            onClick={() => student.qr_token && doCheckin({ qrToken: student.qr_token })}
            disabled={checkinPending || !student.qr_token}
            style={{
              background: 'var(--accent-brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '13px',
              fontWeight: 700,
              fontSize: 14,
              cursor: (checkinPending || !student.qr_token) ? 'not-allowed' : 'pointer',
              opacity: (checkinPending || !student.qr_token) ? 0.7 : 1,
            }}
          >
            {checkinPending ? 'En cours…' : 'Enregistrer entrée'}
          </button>
        )}
        <Link
          href={`/employee/students/${student.id}`}
          style={{
            display: 'block',
            textAlign: 'center',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '13px',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          Modifier le profil
        </Link>
      </div>
    </div>
  )
}

export function LookupClient({ students, currentlyIn: initialCurrentlyIn }: LookupClientProps) {
  const [query, setQuery] = useState('')
  const [currentlyIn, setCurrentlyIn] = useState<CurrentlyIn[]>(initialCurrentlyIn)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const studentMap = useMemo(() => {
    const m: Record<string, Student> = {}
    for (const s of students) m[s.id] = s
    return m
  }, [students])

  const attMap = useMemo(() => {
    const m: Record<string, CurrentlyIn> = {}
    for (const a of currentlyIn) m[a.studentId] = a
    return m
  }, [currentlyIn])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return students.filter(
      s =>
        (s.full_name?.toLowerCase().includes(q)) ||
        (s.phone?.toLowerCase().includes(q))
    )
  }, [query, students])

  const selectedAttendance = selectedStudent ? (attMap[selectedStudent.id] ?? null) : null

  const router = useRouter()

  function handleCheckin(studentId: string) {
    router.refresh()
    setCurrentlyIn(prev => [...prev, { studentId, attendanceId: '', roomName: '—' }])
  }

  function handleCheckout(studentId: string) {
    router.refresh()
    setCurrentlyIn(prev => prev.filter(a => a.studentId !== studentId))
  }

  if (selectedStudent) {
    return (
      <DetailView
        student={selectedStudent}
        attendance={selectedAttendance}
        onBack={() => setSelectedStudent(null)}
        onCheckin={handleCheckin}
        onCheckout={handleCheckout}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'relative' }}>
        <MagnifyingGlass
          size={16}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un étudiant…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 14px 11px 38px',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 14,
            outline: 'none',
            background: '#fff',
          }}
        />
      </div>

      {query.trim() === '' ? (
        <div>
          <SectionHeader label={`Actuellement présents (${currentlyIn.length})`} />
          {currentlyIn.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
              Aucun étudiant présent
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentlyIn.map(a => {
                const s = studentMap[a.studentId]
                if (!s) return null
                return (
                  <StudentCard
                    key={a.studentId}
                    student={s}
                    subtitle={a.roomName}
                    onClick={() => setSelectedStudent(s)}
                  />
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <SectionHeader label={`Résultats (${filtered.length})`} />
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
              Aucun étudiant trouvé
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(s => (
                <StudentCard
                  key={s.id}
                  student={s}
                  subtitle={s.university ?? s.phone ?? '—'}
                  onClick={() => setSelectedStudent(s)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
