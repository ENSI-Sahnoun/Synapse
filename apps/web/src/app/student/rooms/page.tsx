import { getRoomsWithSeatCounts } from '@/data/admin/rooms'
import { getMyPresence } from '@/data/student/profile'
import Link from 'next/link'

type StatusConfig = {
  label: string
  dot: string
  bar: string
  border: string
  bg: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  open: {
    label: 'Ouverte',
    dot: 'var(--synapse-green-500)',
    bar: 'var(--synapse-green-500)',
    border: 'var(--border-subtle)',
    bg: 'white',
  },
  closed: {
    label: 'Fermée',
    dot: 'var(--synapse-stone-400)',
    bar: 'var(--synapse-stone-300)',
    border: 'var(--border-subtle)',
    bg: 'var(--synapse-cream-50)',
  },
  reserved: {
    label: 'Réservée',
    dot: 'var(--synapse-orange-500)',
    bar: 'var(--synapse-orange-400)',
    border: 'var(--synapse-cream-300)',
    bg: 'var(--synapse-cream-50)',
  },
}

export default async function StudentRoomsPage() {
  const [rooms, presence] = await Promise.all([getRoomsWithSeatCounts(), getMyPresence()])
  const myRoomId = presence.status === 'seated' ? presence.roomId : null
  const openRooms = rooms.filter((r) => r.status === 'open')
  const unavailable = rooms.filter((r) => r.status !== 'open')

  function RoomCard({
    room,
    clickable,
  }: {
    room: (typeof rooms)[0]
    clickable: boolean
  }) {
    const status = room.status ?? 'closed'
    const cfg = STATUS_MAP[status] ?? STATUS_MAP.closed
    const pct =
      room.seat_count > 0
        ? Math.round((room.occupied_count / room.seat_count) * 100)
        : 0
    const free = room.seat_count - room.occupied_count
    const isMyRoom = room.id === myRoomId

    const inner = (
      <div
        style={{
          background: cfg.bg,
          border: isMyRoom ? '2px solid #22c55e' : `1px solid ${cfg.border}`,
          borderRadius: 16,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          opacity: clickable ? 1 : 0.7,
          transition: 'box-shadow 0.15s',
        }}
      >
        {isMyRoom && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>Vous êtes ici</span>
        )}
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {room.name}
            </div>
            {room.status_note && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginTop: 3,
                  lineHeight: 1.4,
                  maxWidth: 220,
                }}
              >
                {room.status_note}
              </div>
            )}
          </div>

          {/* Status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 99,
              background: status === 'open' ? 'var(--synapse-green-50, #edfaf4)' : 'var(--synapse-cream-200)',
              border: `1px solid ${cfg.border}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: cfg.dot,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: status === 'open' ? 'var(--synapse-green-700)' : 'var(--synapse-stone-600)',
              }}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Occupancy bar (only for open rooms with seat data) */}
        {room.seat_count > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                height: 6,
                background: 'var(--synapse-cream-200)',
                borderRadius: 99,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background:
                    pct >= 90 ? '#dc2626' : pct >= 70 ? 'var(--synapse-orange-500)' : cfg.bar,
                  borderRadius: 99,
                  transition: 'width 0.4s',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}
              >
                {clickable
                  ? free > 0
                    ? `${free} place${free > 1 ? 's' : ''} disponible${free > 1 ? 's' : ''}`
                    : 'Complet'
                  : `${room.occupied_count}/${room.seat_count} places`}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {room.occupied_count}/{room.seat_count}
              </span>
            </div>
          </div>
        )}
      </div>
    )

    // Always link through, even when full/closed/reserved — students can still
    // see the room and who's where, they just can't reserve/interact there.
    return (
      <Link
        href={`/student/rooms/${room.id}/map`}
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        minHeight: '100%',
        background: 'var(--bg-base)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 16px 4px' }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}
        >
          Choisir une salle
        </h1>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Open rooms */}
        {openRooms.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
                marginBottom: 2,
              }}
            >
              Disponibles
            </div>
            {openRooms.map((room) => (
              <RoomCard key={room.id} room={room} clickable />
            ))}
          </>
        )}

        {openRooms.length === 0 && (
          <div
            style={{
              background: 'white',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 14,
            }}
          >
            Aucune salle ouverte pour le moment.
          </div>
        )}

        {/* Unavailable rooms */}
        {unavailable.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
                marginTop: 8,
                marginBottom: 2,
              }}
            >
              Non disponibles
            </div>
            {unavailable.map((room) => (
              <RoomCard key={room.id} room={room} clickable={false} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
