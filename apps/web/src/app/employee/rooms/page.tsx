import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { SetRoomStatusDialog } from '@/app/admin/rooms/SetRoomStatusDialog'
import { GridFour } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EmployeeRoomsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rooms } = await supabase.from('rooms').select('*').order('name')

  const roomList = rooms ?? []
  const roomIds = roomList.map(r => r.id)

  const { data: openAtt } = roomIds.length > 0
    ? await supabase
        .from('attendance')
        .select('room_id')
        .is('checked_out_at', null)
        .in('room_id', roomIds)
    : { data: [] }

  const occupiedCounts: Record<string, number> = {}
  for (const a of openAtt ?? []) {
    if (a.room_id) occupiedCounts[a.room_id] = (occupiedCounts[a.room_id] ?? 0) + 1
  }

  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Salles</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>
          Occupancy en temps réel
        </p>
      </div>

      {roomList.map(room => {
        const occupied = occupiedCounts[room.id] ?? 0
        const pct = room.capacity > 0 ? Math.min((occupied / room.capacity) * 100, 100) : 0
        const isFull = pct >= 90
        const isClosed = room.status === 'closed'

        const statusLabel = isClosed ? 'Fermé' : pct >= 100 ? 'Plein' : 'Ouvert'
        const statusColor = isClosed
          ? 'var(--muted-foreground)'
          : pct >= 100
          ? 'var(--synapse-orange-600, #ea580c)'
          : 'var(--synapse-green-500)'
        const statusBg = isClosed
          ? 'var(--border-subtle)'
          : pct >= 100
          ? 'rgba(234,88,12,0.1)'
          : 'var(--synapse-green-50)'

        return (
          <div
            key={room.id}
            style={{
              background: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{room.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {occupied} / {room.capacity} places
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: statusColor,
                  background: statusBg, borderRadius: 99, padding: '3px 10px',
                }}>
                  {statusLabel}
                </span>
              </div>
            </div>

            <div style={{
              height: 6, background: 'var(--border-subtle)',
              borderRadius: 3, overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: isFull ? 'var(--synapse-orange-600, #ea580c)' : 'var(--synapse-green-500)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/employee/rooms/${room.id}/map`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '7px 12px', fontSize: 12, fontWeight: 500,
                  color: 'var(--text-secondary)', textDecoration: 'none',
                }}
              >
                <GridFour size={14} />
                Plan
              </Link>
              <SetRoomStatusDialog room={room} />
            </div>
          </div>
        )
      })}

      {roomList.length === 0 && (
        <div style={{
          textAlign: 'center', color: 'var(--text-tertiary)',
          fontSize: 14, padding: '32px 0',
        }}>
          Aucune salle configurée
        </div>
      )}
    </div>
  )
}
