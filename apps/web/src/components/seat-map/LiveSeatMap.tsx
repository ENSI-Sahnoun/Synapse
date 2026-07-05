'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Group } from 'react-konva'
import { ArrowsOut, X } from '@phosphor-icons/react'
import { createClient } from '@/supabase-clients/client'
import { CapacityBadge } from './CapacityBadge'
import { DoorGlyph } from './TableToken'
import type { RoomTable, Seat } from '@/data/admin/seat-map'
import type { Room } from '@/data/admin/rooms'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600

const SEAT_W = 30
const SEAT_H = 26
const BACK_H = 9
const BACK_GAP = 3
const BACK_Y = -(SEAT_H / 2) - BACK_GAP - BACK_H

const TABLE_FILL: Record<string, string> = {
  free: '#fde8c8',
  occupied: '#fef3c7',
  reserved: '#fef3c7',
}
const TABLE_STROKE: Record<string, string> = {
  free: '#a16207',
  occupied: '#f59e0b',
  reserved: '#f59e0b',
}
const SEAT_FILL: Record<string, string> = {
  free: '#3b82f6',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  out_of_service: '#9ca3af',
}

type Props = {
  room: Room
  initialTables: RoomTable[]
  initialSeats: Seat[]
  mode: 'employee' | 'student' | 'readonly'
  onSeatClick?: (seat: Seat) => void
  /** Seat the viewing student currently occupies — drawn in a distinct color regardless of status */
  highlightSeatId?: string | null
  /** Tap-to-expand fullscreen view — student pages only */
  allowFullscreen?: boolean
  /** Skip the room-name heading when the parent page already shows it */
  hideRoomName?: boolean
}

export function LiveSeatMap({ room, initialTables, initialSeats, mode, onSeatClick, highlightSeatId, allowFullscreen, hideRoomName }: Props) {
  const [tables, setTables] = useState<RoomTable[]>(initialTables)
  const [seats, setSeats] = useState<Seat[]>(initialSeats)
  const [occupantNames, setOccupantNames] = useState<Record<string, string>>({})
  // Occupied seat ids that actually have an open attendance row. null = not yet
  // loaded (don't override anything until we know). Occupied seats absent from
  // this set are stale (owner unknown) and render as vacant.
  const [attendedSeatIds, setAttendedSeatIds] = useState<Set<string> | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; name: string } | null>(null)

  // The seat plan is laid out on a fixed 900x600 canvas. Inline, the container
  // only has a real *width* to go on (height is self-imposed), so we scale
  // to fit that width, rotating 90° first if that lets it use more space.
  // In fullscreen the container has a real flex-driven height too, so we fit
  // both dimensions and rotate whichever way is more legible — the header
  // stays put; only this canvas box rotates.
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [rotated, setRotated] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [box, setBox] = useState({ w: 0, h: 0 })

  // User pinch/wheel zoom + two-finger pan, applied on top of the auto-fit as a
  // uniform CSS transform. Uniform scale + translate keep Konva's pointer
  // hit-testing correct (only rotation breaks it), so seats stay clickable.
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const pinchRef = useRef<{ dist: number; mx: number; my: number } | null>(null)

  // Reset zoom whenever fullscreen opens/closes.
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [fullscreen])

  function onTouchMove(e: React.TouchEvent) {
    if (!fullscreen || e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const mx = (a.clientX + b.clientX) / 2
    const my = (a.clientY + b.clientY) / 2
    const prev = pinchRef.current
    if (prev) {
      const f = dist / prev.dist
      setZoom((z) => Math.min(6, Math.max(1, z * f)))
      setPan((p) => ({ x: p.x + (mx - prev.mx), y: p.y + (my - prev.my) }))
    }
    pinchRef.current = { dist, mx, my }
  }
  function onTouchEnd() { pinchRef.current = null }
  function onWheel(e: React.WheelEvent) {
    if (!fullscreen) return
    setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.1 : 0.9))))
  }

  // Inline we lay out on the fixed 900x600 canvas. In fullscreen we instead
  // zoom to the actual content's bounding box, so seats fill the phone screen
  // and icons get large (fitting the whole empty canvas made them tiny).
  const bounds = useMemo(() => {
    if (!fullscreen) return { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const add = (x: number, y: number, r: number) => {
      minX = Math.min(minX, x - r); minY = Math.min(minY, y - r)
      maxX = Math.max(maxX, x + r); maxY = Math.max(maxY, y + r)
    }
    const seatR = SEAT_H / 2 + BACK_GAP + BACK_H // furthest extent from a seat's center
    for (const s of seats) add(s.position_x, s.position_y, seatR)
    for (const t of tables) add(t.position_x, t.position_y, Math.hypot(t.width, t.height) / 2)
    if (!isFinite(minX)) return { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT }
    const pad = 24
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [fullscreen, seats, tables])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Read the live box directly rather than trusting the ResizeObserver
    // entry's contentRect — with a flex-grown (min-h-0) fullscreen container
    // the first delivered entry can report a stale/zero height before the
    // flex layout has actually settled, which silently fell back to the
    // width-only (non-fullscreen) formula and made the canvas look unchanged.
    function recompute() {
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      if (!width) return
      setBox({ w: width, h: height })
      const cap = fullscreen ? 4 : 1

      // Rotation is only ever applied in the student fullscreen layout, where
      // fitting a landscape room onto a portrait phone is worth it. The inline
      // (employee) canvas must never rotate — just fit to width.
      if (fullscreen && height) {
        const scaleNormal = Math.min(cap, width / bounds.w, height / bounds.h)
        const scaleRotated = Math.min(cap, width / bounds.h, height / bounds.w)
        if (scaleRotated > scaleNormal) {
          setRotated(true)
          setScale(scaleRotated)
        } else {
          setRotated(false)
          setScale(scaleNormal)
        }
      } else {
        setRotated(false)
        setScale(Math.min(cap, width / bounds.w))
      }
    }

    const observer = new ResizeObserver(recompute)
    // Re-measure a couple of times right after mount/toggle too, since the
    // very first ResizeObserver callback can fire before flex/layout settles.
    recompute()
    const raf1 = requestAnimationFrame(recompute)
    const t1 = setTimeout(recompute, 150)
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf1)
      clearTimeout(t1)
    }
  }, [fullscreen, bounds.w, bounds.h])

  const occupiedCount = seats.filter((s) => s.status === 'occupied' || s.status === 'reserved').length
  const isRoomClosed = room.status === 'closed' || room.status === 'reserved'

  // Prefetch occupant/reservation names so hovering a seat shows them instantly
  useEffect(() => {
    const supabase = createClient()
    const occupiedSeatIds = seats.filter((s) => s.status === 'occupied').map((s) => s.id)
    const reservedSeatIds = seats.filter((s) => s.status === 'reserved').map((s) => s.id)

    async function load() {
      const names: Record<string, string> = {}

      const attended = new Set<string>()
      if (occupiedSeatIds.length > 0) {
        const { data } = await supabase
          .from('attendance')
          .select('seat_id, profiles!attendance_student_id_fkey(full_name)')
          .in('seat_id', occupiedSeatIds)
          .is('checked_out_at', null)
        for (const row of data ?? []) {
          if (row.seat_id) attended.add(row.seat_id)
          const name = (row.profiles as unknown as { full_name: string | null } | null)?.full_name
          if (row.seat_id && name) names[row.seat_id] = name
        }
      }
      setAttendedSeatIds(attended)

      if (reservedSeatIds.length > 0) {
        const { data } = await supabase
          .from('reservations')
          .select('seat_id, profiles!reservations_student_id_fkey(full_name)')
          .in('seat_id', reservedSeatIds)
          .eq('status', 'active')
        for (const row of data ?? []) {
          const name = (row.profiles as unknown as { full_name: string | null } | null)?.full_name
          if (row.seat_id && name) names[row.seat_id] = name
        }
      }

      setOccupantNames(names)
    }

    if (occupiedSeatIds.length > 0 || reservedSeatIds.length > 0) load()
    else { setOccupantNames({}); setAttendedSeatIds(new Set()) }
  }, [seats])

  useEffect(() => {
    const supabase = createClient()
    const uid = Math.random().toString(36).slice(2, 7)

    const tablesChannel = supabase
      .channel(`live-tables:${room.id}:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as RoomTable
            setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as RoomTable
            setTables((prev) => {
              if (prev.find((t) => t.id === inserted.id)) return prev
              return [...prev, inserted]
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setTables((prev) => prev.filter((t) => t.id !== deleted.id))
          }
        },
      )
      .subscribe()

    const seatsChannel = supabase
      .channel(`live-seats:${room.id}:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Seat
            setSeats((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Seat
            setSeats((prev) => {
              if (prev.find((s) => s.id === inserted.id)) return prev
              return [...prev, inserted]
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setSeats((prev) => prev.filter((s) => s.id !== deleted.id))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(tablesChannel)
      void supabase.removeChannel(seatsChannel)
    }
  }, [room.id])

  function isSeatClickable(seat: Seat): boolean {
    if (mode === 'readonly') return false
    if (mode === 'student') {
      if (isRoomClosed) return false
      return seat.status === 'free'
    }
    // employee: any seat except out_of_service
    return seat.status !== 'out_of_service'
  }

  const legend = (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> Libre
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Occupée
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" /> Réservée
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-gray-400" /> Hors service
      </span>
      {highlightSeatId && (
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#22c55e' }} /> Votre place
        </span>
      )}
    </div>
  )

  function handleSeatClick(seat: Seat) {
    if (!isSeatClickable(seat)) return
    onSeatClick?.(seat)
  }

  const canvasBox = (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border bg-slate-50 w-full"
      style={fullscreen ? { height: '100%', minHeight: 0, touchAction: 'none' } : { height: (rotated ? bounds.w : bounds.h) * scale }}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {allowFullscreen && !fullscreen && (
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="absolute inset-0 z-20 flex items-center justify-center gap-2 hover:bg-black/5 active:bg-black/10 transition-colors"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white opacity-90">
            <ArrowsOut size={14} />
            Toucher pour agrandir
          </span>
        </button>
      )}
        {hover && !rotated && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
            style={{
              // Content is scaled and centered in the box, so map the seat's
              // canvas coords through the same scale + centering offset.
              left: (box.w - bounds.w * scale) / 2 + (hover.x - bounds.x) * scale,
              top: (box.h - bounds.h * scale) / 2 + (hover.y - bounds.y) * scale,
            }}
          >
            {hover.name}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
        <div
          style={{
            // Rotation is done inside Konva (Layer), not via CSS, so the DOM
            // box stays axis-aligned — a CSS rotate breaks Konva's pointer
            // hit-testing and seat taps miss. CSS only applies uniform scale,
            // which Konva maps correctly.
            width: rotated ? bounds.h : bounds.w,
            height: rotated ? bounds.w : bounds.h,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
        <Stage width={rotated ? bounds.h : bounds.w} height={rotated ? bounds.w : bounds.h}>
          <Layer rotation={rotated ? 90 : 0} x={rotated ? bounds.h : 0}>
           <Group x={-bounds.x} y={-bounds.y}>
            {tables.map((table) => {
              const w = table.width
              const h = table.height
              const lx = -w / 2
              const ly = -h / 2
              const LEG = 8
              if (table.table_type === 'door') {
                return (
                  <Group key={table.id} x={table.position_x} y={table.position_y} rotation={table.rotation} listening={false}>
                    <DoorGlyph width={w} />
                  </Group>
                )
              }
              const fill = TABLE_FILL[table.status] ?? '#fde8c8'
              const stroke = TABLE_STROKE[table.status] ?? '#a16207'
              return (
                <Group key={table.id} x={table.position_x} y={table.position_y} rotation={table.rotation}>
                  <Rect x={lx} y={ly} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={4} shadowBlur={2} shadowColor="#00000022" shadowOffsetY={1} />
                  <Rect x={lx + 6} y={ly + 6} width={w - 12} height={h - 12} fill="transparent" stroke="#c2855a" strokeWidth={0.8} cornerRadius={2} listening={false} />
                  <Rect x={lx} y={ly} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  <Rect x={lx + w - LEG} y={ly} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  <Rect x={lx} y={ly + h - LEG} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  <Rect x={lx + w - LEG} y={ly + h - LEG} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  {table.label ? (
                    <Text x={lx} y={ly} text={table.label} fontSize={12} fontStyle="bold" fill="#78350f" align="center" verticalAlign="middle" width={w} height={h} listening={false} />
                  ) : null}
                </Group>
              )
            })}

            {seats.map((seat) => {
              const isClickable = isSeatClickable(seat)
              const isMine = seat.id === highlightSeatId
              // A seat marked occupied but with no open attendance (once loaded)
              // has an unknown owner — render it vacant rather than anonymous.
              // Students can only read their own attendance rows (RLS), so this
              // check would misfire for every seat occupied by someone else —
              // restrict it to staff, who can see all attendance rows.
              const staleOccupied =
                mode !== 'student' &&
                seat.status === 'occupied' && attendedSeatIds !== null && !attendedSeatIds.has(seat.id)
              const baseStatus = staleOccupied ? 'free' : seat.status
              const effectiveStatus = isRoomClosed && mode === 'student' ? 'out_of_service' : baseStatus
              const fill = isMine ? '#22c55e' : (SEAT_FILL[effectiveStatus] ?? SEAT_FILL.free)
              const opacity = effectiveStatus === 'out_of_service' && !isMine ? 0.55 : 1
              return (
                <Group
                  key={seat.id}
                  x={seat.position_x}
                  y={seat.position_y}
                  rotation={seat.rotation}
                  opacity={opacity}
                  onClick={() => handleSeatClick(seat)}
                  onTap={() => handleSeatClick(seat)}
                  onMouseEnter={(e) => {
                    if (isClickable) e.target.getStage()!.container().style.cursor = 'pointer'
                    const name = occupantNames[seat.id]
                    if (name) setHover({ x: seat.position_x, y: seat.position_y - SEAT_H, name })
                  }}
                  onMouseLeave={(e) => {
                    e.target.getStage()!.container().style.cursor = 'default'
                    setHover(null)
                  }}
                >
                  <Rect x={-SEAT_W / 2} y={BACK_Y} width={SEAT_W} height={BACK_H} fill={fill} stroke={isMine ? '#15803d' : '#1e3a5f'} strokeWidth={isMine ? 2.5 : 1.5} cornerRadius={[4, 4, 1, 1]} listening={false} />
                  <Rect x={-SEAT_W / 2} y={-SEAT_H / 2} width={SEAT_W} height={SEAT_H} fill={fill} stroke={isMine ? '#15803d' : '#1e3a5f'} strokeWidth={isMine ? 2.5 : 1.5} cornerRadius={[1, 1, 4, 4]} />
                  <Text x={-SEAT_W / 2} y={-SEAT_H / 2} text={seat.label} fontSize={seat.label.length > 2 ? 9 : 11} fontStyle="bold" fill="#ffffff" align="center" verticalAlign="middle" width={SEAT_W} height={SEAT_H} listening={false} />
                </Group>
              )
            })}
           </Group>
          </Layer>
        </Stage>
        </div>
        </div>
    </div>
  )

  // Single return with the same element structure in both modes — only
  // classNames/styles toggle. Branching into two separate return trees
  // caused React to lose track of the canvas container's DOM node across
  // the fullscreen transition (stale ResizeObserver, wrong scale/position).
  return (
    <div className={fullscreen ? 'fixed inset-0 z-40 flex flex-col gap-3 bg-white p-4' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {(!hideRoomName || fullscreen) && <h2 className="font-semibold">{room.name}</h2>}
          {!isRoomClosed && <CapacityBadge occupiedCount={occupiedCount} totalSeats={seats.length} />}
        </div>
        {fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium"
          >
            <X size={16} />
            Fermer
          </button>
        )}
      </div>

      {isRoomClosed && (
        <div className="shrink-0 rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
          <span className="font-medium">
            {room.status === 'closed' ? 'Salle fermée' : 'Salle réservée'}
          </span>
          {room.status_note ? <span className="ml-2">— {room.status_note}</span> : null}
        </div>
      )}

      <div className={fullscreen ? 'flex-1 min-h-0' : ''}>{canvasBox}</div>

      {!fullscreen && legend}
    </div>
  )
}
