'use client'

import { useCallback, useRef, useState } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import type Konva from 'konva'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableToken, type TableData } from '@/components/seat-map/TableToken'
import { SeatToken, type SeatTokenData } from '@/components/seat-map/SeatToken'
import { PropertiesPanel } from '@/components/seat-map/PropertiesPanel'
import { upsertSeatMapAction, deleteTableAction, deleteSeatAction } from '@/actions/admin/seat-map'
import type { RoomTable, Seat } from '@/data/admin/seat-map'
import {
  snapToGrid,
  snapRotation,
  rotatePoint,
  chairPositionsAroundTable,
  distributeHorizontally,
  distributeVertically,
} from '@/components/seat-map/canvas-utils'
import { Plus, FloppyDisk, ArrowsHorizontal, ArrowsVertical, GridFour } from '@phosphor-icons/react'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const GRID_SIZE = 40
const SEAT_RADIUS = 24
const DEFAULT_TABLE_W = 120
const DEFAULT_TABLE_H = 80

function dbTableToData(t: RoomTable): TableData {
  return {
    localId: t.id,
    id: t.id,
    room_id: t.room_id,
    label: t.label,
    position_x: t.position_x,
    position_y: t.position_y,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
  }
}

function dbSeatToData(s: Seat): SeatTokenData {
  return {
    localId: s.id,
    id: s.id,
    room_id: s.room_id,
    table_id: s.table_id,
    label: s.label,
    position_x: s.position_x,
    position_y: s.position_y,
    rotation: s.rotation,
    status: s.status as SeatTokenData['status'],
  }
}

function nextSeatLabel(existingLabels: Set<string>): string {
  for (const row of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    for (let n = 1; n <= 20; n++) {
      const label = `${row}${n}`
      if (!existingLabels.has(label)) return label
    }
  }
  return `P${existingLabels.size + 1}`
}

type Selection =
  | { type: 'table'; localId: string }
  | { type: 'seat'; localId: string }
  | null

type Props = {
  roomId: string
  initialTables: RoomTable[]
  initialSeats: Seat[]
}

export function EditorCanvas({ roomId, initialTables, initialSeats }: Props) {
  const [tables, setTables] = useState<TableData[]>(initialTables.map(dbTableToData))
  const [seats, setSeats] = useState<SeatTokenData[]>(initialSeats.map(dbSeatToData))
  const [selection, setSelection] = useState<Selection>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const stageRef = useRef<Konva.Stage>(null)

  const selectedTable =
    selection?.type === 'table'
      ? tables.find((t) => t.localId === selection.localId) ?? null
      : null
  const selectedSeat =
    selection?.type === 'seat'
      ? seats.find((s) => s.localId === selection.localId) ?? null
      : null

  const panelSelection = selectedTable
    ? { type: 'table' as const, item: selectedTable }
    : selectedSeat
      ? { type: 'seat' as const, item: selectedSeat }
      : null

  const { execute: save, isPending: isSaving } = useAction(upsertSeatMapAction, {
    onSuccess: () => toast.success('Plan de salle enregistré'),
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'enregistrement"),
  })

  const { execute: execDeleteTable } = useAction(deleteTableAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur suppression table'),
  })

  const { execute: execDeleteSeat } = useAction(deleteSeatAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur suppression chaise'),
  })

  // --- Snap helper ---
  const snap = useCallback(
    (v: number) => (snapEnabled ? snapToGrid(v, GRID_SIZE) : v),
    [snapEnabled],
  )

  // --- Table handlers ---
  // dx/dy come directly from Konva's drag delta (captured via onDragStart ref in TableToken)
  // so they reflect the actual pixel movement, not a state-derived diff that can go stale.
  const handleTableDragEnd = useCallback(
    (localId: string, x: number, y: number, dx: number, dy: number) => {
      const snappedX = snap(x)
      const snappedY = snap(y)
      // Apply snap correction to the delta so chairs land on grid too
      const snappedDx = snappedX - snap(x - dx)
      const snappedDy = snappedY - snap(y - dy)
      setTables((prev) =>
        prev.map((t) =>
          t.localId === localId ? { ...t, position_x: snappedX, position_y: snappedY } : t,
        ),
      )
      setSeats((prev) =>
        prev.map((s) =>
          s.table_id === localId
            ? { ...s, position_x: s.position_x + snappedDx, position_y: s.position_y + snappedDy }
            : s,
        ),
      )
    },
    [snap],
  )

  const handleSeatRotate = useCallback((localId: string, delta: number) => {
    setSeats((prev) =>
      prev.map((s) =>
        s.localId === localId
          ? { ...s, rotation: snapRotation((s.rotation + delta + 360) % 360, 15) }
          : s,
      ),
    )
  }, [])

  // delta: degrees to add (e.g. +15 or -15)
  const handleTableRotate = useCallback((localId: string, delta: number) => {
    setTables((prev) => {
      const table = prev.find((t) => t.localId === localId)
      if (!table) return prev
      const newRotation = snapRotation(table.rotation + delta, 15)
      const cx = table.position_x
      const cy = table.position_y
      setSeats((prevSeats) =>
        prevSeats.map((s) => {
          if (s.table_id !== localId) return s
          const rotated = rotatePoint(s.position_x, s.position_y, cx, cy, delta)
          return {
            ...s,
            position_x: rotated.x,
            position_y: rotated.y,
            rotation: snapRotation((s.rotation + delta + 360) % 360, 15),
          }
        }),
      )
      return prev.map((t) => (t.localId === localId ? { ...t, rotation: newRotation } : t))
    })
  }, [])

  // --- Seat handlers ---
  const handleSeatDragEnd = useCallback(
    (localId: string, x: number, y: number) => {
      setSeats((prev) =>
        prev.map((s) =>
          s.localId === localId ? { ...s, position_x: snap(x), position_y: snap(y) } : s,
        ),
      )
    },
    [snap],
  )

  // --- Add table + chairs ---
  const handleAddTableWithChairs = useCallback(
    (chairCount: number) => {
      const tableId = crypto.randomUUID()
      const newTable: TableData = {
        localId: tableId,
        id: undefined,
        room_id: roomId,
        label: '',
        position_x: snap(CANVAS_WIDTH / 2),
        position_y: snap(CANVAS_HEIGHT / 2),
        width: DEFAULT_TABLE_W,
        height: DEFAULT_TABLE_H,
        rotation: 0,
      }
      const chairPositions = chairPositionsAroundTable(newTable, chairCount)

      // Build labels sequentially to avoid self-reference inside .map()
      const existingLabels = new Set(seats.map((s) => s.label))
      const newSeats: SeatTokenData[] = []
      for (let i = 0; i < chairPositions.length; i++) {
        const pos = chairPositions[i]
        const label = nextSeatLabel(existingLabels)
        existingLabels.add(label)
        newSeats.push({
          localId: crypto.randomUUID(),
          id: undefined,
          room_id: roomId,
          table_id: tableId,
          label,
          position_x: snap(pos.x),
          position_y: snap(pos.y),
          rotation: pos.rotation,
          status: 'free',
        })
      }
      setTables((prev) => [...prev, newTable])
      setSeats((prev) => [...prev, ...newSeats])
    },
    [roomId, seats, snap],
  )

  // --- Add independent chair ---
  const handleAddIndependentChair = useCallback(() => {
    const existingLabels = new Set(seats.map((s) => s.label))
    const label = nextSeatLabel(existingLabels)
    const newSeat: SeatTokenData = {
      localId: crypto.randomUUID(),
      id: undefined,
      room_id: roomId,
      table_id: null,
      label,
      position_x: snap(80),
      position_y: snap(80),
      rotation: 0,
      status: 'free',
    }
    setSeats((prev) => [...prev, newSeat])
  }, [roomId, seats, snap])

  // --- Add chair to existing table ---
  const handleAddChairToTable = useCallback(
    (tableLocalId: string) => {
      const table = tables.find((t) => t.localId === tableLocalId)
      if (!table) return
      const linkedSeats = seats.filter((s) => s.table_id === tableLocalId)
      const newCount = linkedSeats.length + 1
      const positions = chairPositionsAroundTable(table, newCount)
      const lastPos = positions[newCount - 1]
      const existingLabels = new Set(seats.map((s) => s.label))
      const label = nextSeatLabel(existingLabels)
      const newSeat: SeatTokenData = {
        localId: crypto.randomUUID(),
        id: undefined,
        room_id: roomId,
        table_id: tableLocalId,
        label,
        position_x: snap(lastPos.x),
        position_y: snap(lastPos.y),
        rotation: lastPos.rotation,
        status: 'free',
      }
      setSeats((prev) => [...prev, newSeat])
    },
    [roomId, seats, tables, snap],
  )

  // --- Delete ---
  const handleDeleteTable = useCallback(
    (localId: string) => {
      // localId is the table's real DB id once saved; always attempt the delete
      // (no-op if never persisted) so a saved-then-deleted table isn't orphaned.
      execDeleteTable({ id: localId, room_id: roomId })
      // Unlink chairs (don't delete them)
      setSeats((prev) => prev.map((s) => (s.table_id === localId ? { ...s, table_id: null } : s)))
      setTables((prev) => prev.filter((t) => t.localId !== localId))
      setSelection(null)
    },
    [tables, roomId, execDeleteTable],
  )

  const handleDeleteSeat = useCallback(
    (localId: string) => {
      // localId is the seat's real DB id once saved; always attempt the delete
      // (harmless no-op if it was never persisted) so saved-but-stale seats
      // don't get orphaned in the DB.
      execDeleteSeat({ id: localId, room_id: roomId })
      setSeats((prev) => prev.filter((s) => s.localId !== localId))
      setSelection(null)
    },
    [seats, roomId, execDeleteSeat],
  )

  // --- Properties panel changes ---
  const handleTableChange = useCallback((localId: string, patch: Partial<TableData>) => {
    setTables((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)))
  }, [])

  const handleSeatChange = useCallback((localId: string, patch: Partial<SeatTokenData>) => {
    setSeats((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)))
  }, [])

  // --- Distribute ---
  const handleDistributeHorizontal = () => {
    if (selection?.type === 'table') {
      const newXs = distributeHorizontally(
        tables.map((t) => ({ x: t.position_x, width: t.width })),
        GRID_SIZE,
      )
      setTables((prev) => prev.map((t, i) => ({ ...t, position_x: newXs[i] })))
    } else if (selection?.type === 'seat') {
      const newXs = distributeHorizontally(
        seats.map((s) => ({ x: s.position_x, width: SEAT_RADIUS * 2 })),
        GRID_SIZE,
      )
      setSeats((prev) => prev.map((s, i) => ({ ...s, position_x: newXs[i] })))
    }
  }

  const handleDistributeVertical = () => {
    if (selection?.type === 'table') {
      const newYs = distributeVertically(
        tables.map((t) => ({ y: t.position_y, height: t.height })),
        GRID_SIZE,
      )
      setTables((prev) => prev.map((t, i) => ({ ...t, position_y: newYs[i] })))
    } else if (selection?.type === 'seat') {
      const newYs = distributeVertically(
        seats.map((s) => ({ y: s.position_y, height: SEAT_RADIUS * 2 })),
        GRID_SIZE,
      )
      setSeats((prev) => prev.map((s, i) => ({ ...s, position_y: newYs[i] })))
    }
  }

  // --- Save ---
  const handleSave = () => {
    save({
      room_id: roomId,
      tables: tables.map((t) => ({
        id: t.localId,
        room_id: t.room_id,
        label: t.label,
        position_x: t.position_x,
        position_y: t.position_y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
      })),
      seats: seats.map((s) => ({
        // localId is a real uuid (db id for existing seats, generated for new).
        // Sending it for every row means: (a) no NULL-id rows in the bulk
        // upsert, and (b) re-saves match on conflict instead of duplicating.
        id: s.localId,
        room_id: s.room_id,
        table_id: s.table_id,
        label: s.label,
        position_x: s.position_x,
        position_y: s.position_y,
        rotation: s.rotation,
        status: s.status,
      })),
    })
  }

  // --- Grid lines ---
  const gridLines: React.ReactNode[] = []
  for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
    gridLines.push(
      <Line key={`v${x}`} points={[x, 0, x, CANVAS_HEIGHT]} stroke="#e2e8f0" strokeWidth={0.5} />,
    )
  }
  for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
    gridLines.push(
      <Line
        key={`h${y}`}
        points={[0, y, CANVAS_WIDTH, y]}
        stroke="#e2e8f0"
        strokeWidth={0.5}
      />,
    )
  }

  const hasSelection = selection !== null

  return (
    <div className="flex gap-4">
      {/* Main column */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add table dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Ajouter une table
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[1, 2, 4, 6].map((n) => (
                <DropdownMenuItem key={n} onClick={() => handleAddTableWithChairs(n)}>
                  {n} place{n > 1 ? 's' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add independent chair */}
          <Button variant="outline" size="sm" onClick={handleAddIndependentChair}>
            <Plus className="mr-1 h-4 w-4" />
            Chaise indépendante
          </Button>

          {/* Distribute — only when something selected */}
          {hasSelection && (
            <>
              <div className="h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                title="Distribuer horizontalement"
                onClick={handleDistributeHorizontal}
              >
                <ArrowsHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Distribuer verticalement"
                onClick={handleDistributeVertical}
              >
                <ArrowsVertical className="h-4 w-4" />
              </Button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={snapEnabled ? 'secondary' : 'ghost'}
              size="icon"
              title="Grille magnétique"
              onClick={() => setSnapEnabled((v) => !v)}
            >
              <GridFour className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <FloppyDisk className="mr-1 h-4 w-4" />
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="relative overflow-hidden rounded-lg border bg-slate-50"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={(e) => {
              if (e.target === e.target.getStage()) setSelection(null)
            }}
          >
            <Layer>
              {/* Grid */}
              {gridLines}

              {/* Tables */}
              {tables.map((table) => (
                <TableToken
                  key={table.localId}
                  table={table}
                  isSelected={selection?.localId === table.localId}
                  onSelect={(localId) => setSelection({ type: 'table', localId })}
                  onDragEnd={handleTableDragEnd}
                />
              ))}

              {/* Seats */}
              {seats.map((seat) => (
                <SeatToken
                  key={seat.localId}
                  seat={seat}
                  isSelected={selection?.localId === seat.localId}
                  onDragEnd={handleSeatDragEnd}
                  onClick={(localId) => setSelection({ type: 'seat', localId })}
                />
              ))}

            </Layer>
          </Stage>
        </div>

        <p className="text-xs text-muted-foreground">
          Cliquez pour sélectionner · Faites glisser pour repositionner · Utilisez les boutons de
          rotation dans le panneau · Enregistrez pour sauvegarder
        </p>
      </div>

      {/* Properties panel */}
      <div className="w-56 rounded-lg border bg-card">
        <PropertiesPanel
          selection={panelSelection}
          allTables={tables}
          onTableChange={handleTableChange}
          onSeatChange={handleSeatChange}
          onDeleteTable={handleDeleteTable}
          onDeleteSeat={handleDeleteSeat}
          onAddChairToTable={handleAddChairToTable}
          onTableRotate={handleTableRotate}
          onSeatRotate={handleSeatRotate}
        />
      </div>
    </div>
  )
}
