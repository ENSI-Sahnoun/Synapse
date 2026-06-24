'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash, Plus, ArrowCounterClockwise, ArrowClockwise } from '@phosphor-icons/react'
import type { TableData } from './TableToken'
import type { SeatTokenData } from './SeatToken'

type Selection =
  | { type: 'table'; item: TableData }
  | { type: 'seat'; item: SeatTokenData }
  | null

type Props = {
  selection: Selection
  allTables: TableData[]
  onTableChange: (localId: string, patch: Partial<TableData>) => void
  onSeatChange: (localId: string, patch: Partial<SeatTokenData>) => void
  onDeleteTable: (localId: string) => void
  onDeleteSeat: (localId: string) => void
  onAddChairToTable: (tableLocalId: string) => void
  onTableRotate?: (localId: string, delta: number) => void
  onSeatRotate?: (localId: string, delta: number) => void
}

export function PropertiesPanel({
  selection,
  allTables,
  onTableChange,
  onSeatChange,
  onDeleteTable,
  onDeleteSeat,
  onAddChairToTable,
  onTableRotate,
  onSeatRotate,
}: Props) {
  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4 text-center">
        Sélectionnez un élément pour modifier ses propriétés
      </div>
    )
  }

  if (selection.type === 'table') {
    const table = selection.item
    return (
      <div className="space-y-4 p-4">
        <h3 className="font-semibold text-sm">Table</h3>

        <div className="space-y-1">
          <Label>Étiquette</Label>
          <Input
            value={table.label}
            maxLength={20}
            onChange={(e) => onTableChange(table.localId, { label: e.target.value })}
            placeholder="T1"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Largeur</Label>
            <Input
              type="number"
              min={40}
              max={400}
              value={table.width}
              onChange={(e) => onTableChange(table.localId, { width: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Hauteur</Label>
            <Input
              type="number"
              min={40}
              max={400}
              value={table.height}
              onChange={(e) => onTableChange(table.localId, { height: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Rotation</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              title="Tourner −15°"
              onClick={() => onTableRotate?.(table.localId, -15)}
            >
              <ArrowCounterClockwise className="h-3.5 w-3.5" />
            </Button>
            <span className="flex-1 text-center text-sm tabular-nums">{table.rotation}°</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              title="Tourner +15°"
              onClick={() => onTableRotate?.(table.localId, 15)}
            >
              <ArrowClockwise className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onAddChairToTable(table.localId)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une chaise
        </Button>

        <div className="border-t pt-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDeleteTable(table.localId)}
          >
            <Trash className="mr-2 h-4 w-4" />
            Supprimer la table
          </Button>
        </div>
      </div>
    )
  }

  // seat
  const seat = selection.item
  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm">Chaise</h3>

      <div className="space-y-1">
        <Label>Étiquette</Label>
        <Input
          value={seat.label}
          maxLength={10}
          onChange={(e) => onSeatChange(seat.localId, { label: e.target.value })}
          placeholder="A1"
        />
      </div>

      <div className="space-y-1">
        <Label>Table liée</Label>
        <Select
          value={seat.table_id ?? 'none'}
          onValueChange={(val) =>
            onSeatChange(seat.localId, { table_id: val === 'none' ? null : val })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Indépendante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Indépendante</SelectItem>
            {allTables.map((t) => (
              <SelectItem key={t.localId} value={t.localId}>
                {t.label || `Table ${t.localId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Hors service</Label>
        <Switch
          checked={seat.status === 'out_of_service'}
          onCheckedChange={(checked) =>
            onSeatChange(seat.localId, { status: checked ? 'out_of_service' : 'free' })
          }
        />
      </div>

      <div className="space-y-1">
        <Label>Rotation</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            title="Tourner −15°"
            onClick={() => onSeatRotate?.(seat.localId, -15)}
          >
            <ArrowCounterClockwise className="h-3.5 w-3.5" />
          </Button>
          <span className="flex-1 text-center text-sm tabular-nums">{seat.rotation}°</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            title="Tourner +15°"
            onClick={() => onSeatRotate?.(seat.localId, 15)}
          >
            <ArrowClockwise className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="border-t pt-2">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => onDeleteSeat(seat.localId)}
        >
          <Trash className="mr-2 h-4 w-4" />
          Supprimer la chaise
        </Button>
      </div>
    </div>
  )
}
