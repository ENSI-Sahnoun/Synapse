'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import { MagnifyingGlass, CaretLeft, CaretRight, QrCode, SignIn, SignOut, Armchair } from '@phosphor-icons/react'
import { checkinAction } from '@/actions/checkin/checkin-action'
import { checkoutAction } from '@/actions/checkin/checkout-action'
import { getStudentDetailAction, createStudentAction, updateStudentInfoAction, getStudentAttendanceHistoryAction } from '@/actions/employee/students'
import { createSubscriptionAction } from '@/actions/employee/subscriptions'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { PostCheckinSeatDialog } from '@/components/checkin/PostCheckinSeatDialog'
import { createClient } from '@/supabase-clients/client'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArchivedToggle } from './ArchivedToggle'

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
  roomId: string | null
  roomName: string
  seatLabel: string | null
  planName: string | null
}

function isDailyPlan(planName: string | null): boolean {
  if (!planName) return false
  const n = planName
    .toLowerCase()
    .replace(/é|è|ê/g, 'e')
  return n.includes('journalier') || n.includes('journee')
}

function placeLabel(a: CurrentlyIn | undefined): string | null {
  if (!a) return null
  if (!a.roomName || a.roomName === '—') return 'Divers'
  return a.seatLabel ? `${a.roomName} · ${a.seatLabel}` : a.roomName
}

interface Plan {
  id: string
  name: string
  duration_days: number
  price_dt: number
}

interface LookupClientProps {
  students: Student[]
  currentlyIn: CurrentlyIn[]
  plans: Plan[]
  role: string
  showArchived: boolean
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

const PRESENT_COLORS = {
  green: { border: 'var(--synapse-green-500, #22c55e)', bg: 'var(--synapse-green-50, #f0faf4)', glow: 'rgba(34,197,94,0.18), 0 0 14px rgba(34,197,94,0.35)', text: 'var(--synapse-green-600, #16a34a)' },
  blue: { border: '#3b82f6', bg: '#eff6ff', glow: 'rgba(59,130,246,0.18), 0 0 14px rgba(59,130,246,0.35)', text: '#2563eb' },
}

function StudentCard({
  student,
  present,
  place,
  daily,
  onClick,
}: {
  student: Student
  present?: boolean
  place?: string | null
  daily?: boolean
  onClick: () => void
}) {
  const colors = daily ? PRESENT_COLORS.green : PRESENT_COLORS.blue
  return (
    <button
      onClick={onClick}
      style={{
        background: present ? colors.bg : '#fff',
        border: present ? `1.5px solid ${colors.border}` : '1px solid var(--border-subtle)',
        boxShadow: present ? `0 0 0 3px ${colors.glow}` : 'none',
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
        {present && (
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginTop: 4 }}>
            {place || 'Divers'}
          </div>
        )}
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

interface SubscriptionHistoryRow {
  id: string
  startDate: string
  endDate: string
  paidAmount: number
  planName: string
}

interface AttendanceHistoryRow {
  id: string
  checkedInAt: string
  checkedOutAt: string | null
  roomName: string | null
  seatLabel: string | null
}

interface DetailStats {
  planName: string | null
  endDate: string | null
  loyaltyPoints: number
  totalVisits: number
  history: SubscriptionHistoryRow[]
  phone: string | null
  university: string | null
  studyLevel: string | null
  createdAt: string | null
}

function HistoryRow({ h, showDate }: { h: AttendanceHistoryRow; showDate: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
      <div>
        {showDate && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {new Date(h.checkedInAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {h.roomName ? `${h.roomName}${h.seatLabel ? ` · ${h.seatLabel}` : ''}` : 'Divers'}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        {new Date(h.checkedInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        {' → '}
        {h.checkedOutAt
          ? new Date(h.checkedOutAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : 'présent'}
      </div>
    </div>
  )
}

function GroupToggle({ label, count, open, onClick }: { label: string; count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        background: 'var(--synapse-cream-50, #faf8f5)', border: 'none', cursor: 'pointer',
        padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
      }}
    >
      <span>{label} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>({count})</span></span>
      <span style={{ fontSize: 12, color: 'var(--accent-brand)', fontWeight: 600 }}>{open ? 'Masquer' : 'Afficher'}</span>
    </button>
  )
}

const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Groups visits Year → Month, but only adds a grouping level when the data
// actually spans more than one of that unit — otherwise it's just noise.
function uniqueDayCount(rows: AttendanceHistoryRow[]): number {
  return new Set(rows.map((r) => r.checkedInAt.slice(0, 10))).size
}

function HistoryList({ rows }: { rows: AttendanceHistoryRow[] }) {
  const [openYears, setOpenYears] = useState<Set<number>>(new Set())
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())

  const years = [...new Set(rows.map((r) => new Date(r.checkedInAt).getFullYear()))]
  const groupByYear = years.length > 1

  function renderDays(rowsForGroup: AttendanceHistoryRow[], keyPrefix: string) {
    const dayKeys = [...new Set(rowsForGroup.map((r) => r.checkedInAt.slice(0, 10)))]
    const groupByDay = dayKeys.length > 1

    if (!groupByDay) {
      return rowsForGroup.map((h, i) => (
        <div key={h.id} style={{ borderBottom: i < rowsForGroup.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
          <HistoryRow h={h} showDate />
        </div>
      ))
    }

    return dayKeys.map((dayKey) => {
      const fullDayKey = `${keyPrefix}-${dayKey}`
      const dayRows = rowsForGroup.filter((r) => r.checkedInAt.slice(0, 10) === dayKey)
      const isOpen = openDays.has(fullDayKey)
      return (
        <div key={fullDayKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <GroupToggle
            label={new Date(dayRows[0].checkedInAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            count={dayRows.length}
            open={isOpen}
            onClick={() => setOpenDays((prev) => {
              const next = new Set(prev)
              if (isOpen) next.delete(fullDayKey)
              else next.add(fullDayKey)
              return next
            })}
          />
          {isOpen && dayRows.map((h) => (
            <div key={h.id} style={{ borderTop: '1px solid var(--border-subtle)', paddingLeft: 10 }}>
              <HistoryRow h={h} showDate={false} />
            </div>
          ))}
        </div>
      )
    })
  }

  function renderRows(rowsForGroup: AttendanceHistoryRow[], keyPrefix: string) {
    const months = [...new Set(rowsForGroup.map((r) => new Date(r.checkedInAt).getMonth()))]
    const groupByMonth = months.length > 1

    if (!groupByMonth) {
      return renderDays(rowsForGroup, keyPrefix)
    }

    return months.map((month) => {
      const monthKey = `${keyPrefix}-${month}`
      const monthRows = rowsForGroup.filter((r) => new Date(r.checkedInAt).getMonth() === month)
      const isOpen = openMonths.has(monthKey)
      return (
        <div key={monthKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <GroupToggle
            label={MONTH_NAMES_FR[month]}
            count={uniqueDayCount(monthRows)}
            open={isOpen}
            onClick={() => setOpenMonths((prev) => {
              const next = new Set(prev)
              if (isOpen) next.delete(monthKey)
              else next.add(monthKey)
              return next
            })}
          />
          {isOpen && <div style={{ paddingLeft: 10 }}>{renderDays(monthRows, monthKey)}</div>}
        </div>
      )
    })
  }

  if (!groupByYear) return <>{renderRows(rows, 'y')}</>

  return (
    <>
      {years.map((year) => {
        const yearRows = rows.filter((r) => new Date(r.checkedInAt).getFullYear() === year)
        const isOpen = openYears.has(year)
        return (
          <div key={year} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <GroupToggle
              label={String(year)}
              count={uniqueDayCount(yearRows)}
              open={isOpen}
              onClick={() => setOpenYears((prev) => {
                const next = new Set(prev)
                if (isOpen) next.delete(year)
                else next.add(year)
                return next
              })}
            />
            {isOpen && renderRows(yearRows, `y${year}`)}
          </div>
        )
      })}
    </>
  )
}

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null
  const ms = new Date(endDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(ms / 86_400_000)
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
  role,
  showArchived,
}: {
  student: Student
  attendance: CurrentlyIn | null
  onBack: () => void
  onCheckin: (studentId: string, attendanceId: string) => void
  onCheckout: (studentId: string) => void
  role: string
  showArchived: boolean
}) {
  const [stats, setStats] = useState<DetailStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [seatDialogOpen, setSeatDialogOpen] = useState(false)
  const [checkedInAttendanceId, setCheckedInAttendanceId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({ phone: '', university: '', study_level: '' })
  const [showSubHistory, setShowSubHistory] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showFullHistory, setShowFullHistory] = useState(false)
  const [fullHistory, setFullHistory] = useState<AttendanceHistoryRow[] | null>(null)

  const { execute: fetchDetail } = useAction(getStudentDetailAction, {
    onSuccess: ({ data }) => {
      if (data) {
        setStats(data)
        setEditFields({
          phone: data.phone ?? '',
          university: data.university ?? '',
          study_level: data.studyLevel ?? '',
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
        onCheckin(student.id, data.attendanceId)
        toast.success('Entrée enregistrée')
        if (!data.reservationFulfilled) {
          setCheckedInAttendanceId(data.attendanceId)
          setSeatDialogOpen(true)
        }
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

  const { execute: doUpdate, status: updateStatus } = useAction(updateStudentInfoAction, {
    onSuccess: () => {
      toast.success('Profil mis à jour')
      setEditing(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la mise à jour'),
  })

  const { execute: fetchFullHistory, status: fullHistoryStatus } = useAction(getStudentAttendanceHistoryAction, {
    onSuccess: ({ data }) => setFullHistory(data?.rows ?? []),
    onError: () => setFullHistory([]),
  })

  const isPresent = !!attendance
  const remaining = daysLeft(stats?.endDate ?? null)

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-secondary)' }}>{student.full_name ?? '—'}</span>
            {student.qr_token && (
              <button
                onClick={() => setShowQr((v) => !v)}
                title="QR code"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: showQr ? 'var(--accent-brand)' : 'var(--text-tertiary)' }}
              >
                <QrCode size={22} weight={showQr ? 'fill' : 'regular'} />
              </button>
            )}
            {isPresent && (
              <Link
                href={attendance!.roomId ? `/employee/rooms/${attendance!.roomId}/map` : '/employee/rooms'}
                title="Changer de place"
                style={{ color: 'var(--text-tertiary)', display: 'flex' }}
              >
                <Armchair size={22} />
              </Link>
            )}
            {isPresent ? (
              <button
                onClick={() => {
                  if (window.confirm(`Enregistrer la sortie de ${student.full_name ?? 'cet étudiant'} ?`)) {
                    doCheckout({ attendanceId: attendance!.attendanceId })
                  }
                }}
                disabled={checkoutPending}
                title="Sortie"
                style={{ background: 'none', border: 'none', cursor: checkoutPending ? 'not-allowed' : 'pointer', padding: 2, color: 'var(--destructive)', opacity: checkoutPending ? 0.5 : 1 }}
              >
                <SignOut size={22} />
              </button>
            ) : (
              <button
                onClick={() => student.qr_token && doCheckin({ qrToken: student.qr_token })}
                disabled={checkinPending || !student.qr_token}
                title="Entrée"
                style={{ background: 'none', border: 'none', cursor: (checkinPending || !student.qr_token) ? 'not-allowed' : 'pointer', padding: 2, color: 'var(--synapse-green-500, #22c55e)', opacity: (checkinPending || !student.qr_token) ? 0.5 : 1 }}
              >
                <SignIn size={22} />
              </button>
            )}
          </div>
          {student.university && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{student.university}</div>
          )}
        </div>
        {isPresent && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {attendance!.roomName && attendance!.roomName !== '—'
                ? (attendance!.seatLabel ? `${attendance!.roomName} · ${attendance!.seatLabel}` : attendance!.roomName)
                : 'Divers'}
            </span>
          </div>
        )}
      </div>

      {showQr && student.qr_token && (
        <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <QrCodeImage token={student.qr_token} size={180} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Code secret SYNAPSE</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all', textAlign: 'center' }}>
            {student.qr_token}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <StatTile label="Plan" value={statsLoading ? '…' : (stats?.planName ?? '—')} />
        <StatTile
          label="Jours restants"
          value={statsLoading ? '…' : (remaining === null ? '—' : remaining < 0 ? 'Expiré' : remaining)}
        />
        <StatTile label="Points" value={statsLoading ? '…' : (stats?.loyaltyPoints ?? 0)} />
        <StatTile label="Visites" value={statsLoading ? '…' : (stats?.totalVisits ?? 0)} />
      </div>

      <button
        onClick={() => {
          const next = !showFullHistory
          setShowFullHistory(next)
          if (next && fullHistory === null) fetchFullHistory({ studentId: student.id })
        }}
        style={{
          background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
          padding: '10px', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
        }}
      >
        {showFullHistory ? 'Masquer l\'historique complet' : 'Voir l\'historique complet des visites'}
      </button>

      {showFullHistory && (
        <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {fullHistoryStatus === 'executing' ? (
            <div style={{ padding: 14, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Chargement…</div>
          ) : !fullHistory || fullHistory.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Aucune visite enregistrée</div>
          ) : (
            <HistoryList rows={fullHistory} />
          )}
        </div>
      )}

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
          { label: 'Téléphone', value: student.phone ?? stats?.phone ?? '—' },
          { label: 'Niveau', value: stats?.studyLevel ?? '—' },
          { label: 'Inscrit le', value: stats?.createdAt ? new Date(stats.createdAt).toLocaleDateString('fr-FR') : '—' },
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

      {stats && stats.history.length > 0 && (
        <div>
          <button
            onClick={() => setShowSubHistory((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: 8,
            }}
          >
            <SectionHeader label="Historique des abonnements" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-brand)' }}>
              {showSubHistory ? 'Masquer' : 'Afficher'}
            </span>
          </button>
          {showSubHistory && (
            <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {stats.history.map((h, i) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderBottom: i < stats.history.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{h.planName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {new Date(h.startDate).toLocaleDateString('fr-FR')} → {new Date(h.endDate).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{h.paidAmount} DT</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          href={`/employee/students/${student.id}/subscriptions/new`}
          style={{
            display: 'block', textAlign: 'center', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '13px', fontWeight: 600, fontSize: 14,
            color: 'var(--text-secondary)', textDecoration: 'none',
          }}
        >
          Vendre un abonnement
        </Link>

        {student.qr_token && (
          <Link
            href={`/employee/students/${student.id}/print-qr`}
            style={{
              display: 'block', textAlign: 'center', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', padding: '13px', fontWeight: 600, fontSize: 14,
              color: 'var(--text-secondary)', textDecoration: 'none',
            }}
          >
            Imprimer le QR
          </Link>
        )}

        <button
          onClick={() => setEditing((v) => !v)}
          style={{
            background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
            padding: '13px', fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          {editing ? 'Annuler' : "Modifier l'étudiant"}
        </button>

        {editing && (
          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Téléphone</label>
              <input
                value={editFields.phone}
                onChange={(e) => setEditFields((f) => ({ ...f, phone: e.target.value }))}
                style={{ padding: '9px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Université</label>
              <input
                value={editFields.university}
                onChange={(e) => setEditFields((f) => ({ ...f, university: e.target.value }))}
                style={{ padding: '9px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Niveau d&apos;étude</label>
              <input
                value={editFields.study_level}
                onChange={(e) => setEditFields((f) => ({ ...f, study_level: e.target.value }))}
                style={{ padding: '9px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13 }}
              />
            </div>
            <button
              onClick={() => doUpdate({ id: student.id, ...editFields })}
              disabled={updateStatus === 'executing'}
              style={{
                background: 'var(--accent-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                padding: '10px', fontWeight: 700, fontSize: 13, cursor: updateStatus === 'executing' ? 'not-allowed' : 'pointer',
              }}
            >
              {updateStatus === 'executing' ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      {checkedInAttendanceId && (
        <PostCheckinSeatDialog
          open={seatDialogOpen}
          onOpenChange={setSeatDialogOpen}
          attendanceId={checkedInAttendanceId}
          studentName={student.full_name ?? ''}
        />
      )}
    </div>
  )
}

function QuickAddPanel({ plans, onCreated }: { plans: Plan[]; onCreated: () => void }) {
  const [fullName, setFullName] = useState('')
  const dailyPlan = plans.find((p) => p.name.toLowerCase().includes('journalier'))
  const [planId, setPlanId] = useState(dailyPlan?.id ?? '')
  const [created, setCreated] = useState<{ fullName: string; qrToken: string | null } | null>(null)

  const { execute: doCreateStudent, status: createStatus } = useAction(createStudentAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      if (planId) {
        doCreateSubscription({ student_id: data.studentId, plan_id: planId })
      }
      setCreated({ fullName, qrToken: data.qrToken })
      onCreated()
    },
    onError: ({ error }) => {
      const validation = error.validationErrors as { email?: { _errors?: string[] }; phone?: { _errors?: string[] } } | undefined
      toast.error(error.serverError ?? validation?.email?._errors?.[0] ?? validation?.phone?._errors?.[0] ?? 'Erreur lors de la création')
    },
  })

  const { execute: doCreateSubscription } = useAction(createSubscriptionAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de l\'attribution de l\'abonnement'),
  })

  function reset() {
    setFullName('')
    setPlanId('')
    setCreated(null)
  }

  if (created) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <p style={{ fontWeight: 700, fontSize: 15 }}>{created.fullName}</p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Compte créé — carte d&apos;accès prête</p>
        {created.qrToken ? (
          <QrCodeImage token={created.qrToken} size={180} />
        ) : (
          <p style={{ fontSize: 12, color: 'var(--destructive)' }}>QR non disponible</p>
        )}
        <button
          onClick={reset}
          style={{ background: 'var(--accent-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          Ajouter un autre étudiant
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader label="Nouvel étudiant" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Nom complet</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ex: Sami Ben Ali"
          style={{ padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14, outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Formule d&apos;abonnement</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => setPlanId('')}
            style={{
              border: `1px solid ${planId === '' ? 'var(--accent-brand)' : 'var(--border-default)'}`,
              background: planId === '' ? 'var(--synapse-green-50, #f0faf4)' : '#fff',
              borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: 13, textAlign: 'left', cursor: 'pointer',
            }}
          >
            Aucune (pour l&apos;instant)
          </button>
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPlanId(plan.id)}
              style={{
                border: `1px solid ${planId === plan.id ? 'var(--accent-brand)' : 'var(--border-default)'}`,
                background: planId === plan.id ? 'var(--synapse-green-50, #f0faf4)' : '#fff',
                borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between',
              }}
            >
              <span>{plan.name}</span>
              <span style={{ fontWeight: 600 }}>{plan.price_dt} DT</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => doCreateStudent({
          full_name: fullName,
          phone: '',
          // ponytail: quick panel skips email/phone entry; schema requires one, so mint a placeholder
          email: `quick-${Date.now()}@synapse.local`,
          university: '',
          study_level: '',
        })}
        disabled={!fullName.trim() || createStatus === 'executing'}
        style={{
          background: 'var(--accent-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)',
          padding: '13px', fontWeight: 700, fontSize: 14, marginTop: 4,
          cursor: (!fullName.trim() || createStatus === 'executing') ? 'not-allowed' : 'pointer',
          opacity: (!fullName.trim() || createStatus === 'executing') ? 0.7 : 1,
        }}
      >
        {createStatus === 'executing' ? 'Création…' : 'Créer l\'étudiant'}
      </button>
    </div>
  )
}

export function LookupClient({ students, currentlyIn: initialCurrentlyIn, plans, role, showArchived }: LookupClientProps) {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [currentlyIn, setCurrentlyIn] = useState<CurrentlyIn[]>(initialCurrentlyIn)

  // Adopt fresh server data on every router.refresh().
  useEffect(() => setCurrentlyIn(initialCurrentlyIn), [initialCurrentlyIn])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(() => {
    const wantedId = searchParams.get('studentId')
    return wantedId ? students.find((s) => s.id === wantedId) ?? null : null
  })

  const attMap = useMemo(() => {
    const m: Record<string, CurrentlyIn> = {}
    for (const a of currentlyIn) m[a.studentId] = a
    return m
  }, [currentlyIn])

  const presenceRank = (s: Student) => {
    const a = attMap[s.id]
    if (!a) return 2
    return isDailyPlan(a.planName) ? 0 : 1
  }

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => presenceRank(a) - presenceRank(b))
  }, [students, attMap])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return students
      .filter(
        s =>
          (s.full_name?.toLowerCase().includes(q)) ||
          (s.phone?.toLowerCase().includes(q))
      )
      .sort((a, b) => presenceRank(a) - presenceRank(b))
  }, [query, students, attMap])

  const selectedAttendance = selectedStudent ? (attMap[selectedStudent.id] ?? null) : null

  const router = useRouter()

  // Live: presence badges reflect scans/checkouts from the kiosk or other
  // employees without a manual refresh.
  useEffect(() => {
    const supabase = createClient()
    const topic = 'realtime:lookup-presence'
    const stale = supabase.getChannels().find((c) => c.topic === topic)
    if (stale) supabase.removeChannel(stale)

    const channel = supabase
      .channel('lookup-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () =>
        router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  function handleCheckin(studentId: string, attendanceId: string) {
    router.refresh()
    setCurrentlyIn(prev => [...prev, { studentId, attendanceId, roomId: null, roomName: '—', seatLabel: null, planName: null }])
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
        role={role}
        showArchived={showArchived}
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 items-start">
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <SectionHeader label={`${showArchived ? 'Étudiants archivés' : 'Tous les étudiants'} (${students.length})`} />
            {role === 'admin' && <ArchivedToggle showArchived={showArchived} />}
          </div>
          {students.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
              Aucun étudiant
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedStudents.map(s => {
                const a = attMap[s.id]
                return (
                  <StudentCard
                    key={s.id}
                    student={s}
                    present={!!a}
                    daily={isDailyPlan(a?.planName ?? null)}
                    place={placeLabel(a)}
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
              {filtered.map(s => {
                const a = attMap[s.id]
                return (
                  <StudentCard
                    key={s.id}
                    student={s}
                    present={!!a}
                    daily={isDailyPlan(a?.planName ?? null)}
                    place={placeLabel(a)}
                    onClick={() => setSelectedStudent(s)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>

    <QuickAddPanel plans={plans} onCreated={() => router.refresh()} />
    </div>
  )
}
