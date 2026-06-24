'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Trash } from '@phosphor-icons/react'
import type { SeatTokenData } from './SeatToken'

type Props = {
  seat: SeatTokenData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: React.RefObject<HTMLDivElement>
  onLabelChange: (localId: string, label: string) => void
  onOutOfServiceToggle: (localId: string, outOfService: boolean) => void
  onDelete: (localId: string) => void
}

export function SeatEditPopover({
  seat,
  open,
  onOpenChange,
  anchorRef,
  onLabelChange,
  onOutOfServiceToggle,
  onDelete,
}: Props) {
  if (!seat) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div ref={anchorRef} className="absolute" />
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-4">
        <div className="space-y-1">
          <h4 className="font-medium">Modifier la place</h4>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seat-label">Étiquette</Label>
          <Input
            id="seat-label"
            value={seat.label}
            maxLength={10}
            onChange={(e) => onLabelChange(seat.localId, e.target.value)}
            placeholder="A1"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="out-of-service">Hors service</Label>
          <Switch
            id="out-of-service"
            checked={seat.status === 'out_of_service'}
            onCheckedChange={(checked) => onOutOfServiceToggle(seat.localId, checked)}
          />
        </div>
        <div className="border-t pt-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              onDelete(seat.localId)
              onOpenChange(false)
            }}
          >
            <Trash className="mr-2 h-4 w-4" />
            Supprimer la place
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
