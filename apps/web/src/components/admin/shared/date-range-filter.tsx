'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getPresetRange, type DateRangePreset } from '@/lib/date-range'

type Props = {
  from: string
  to: string
}

export function DateRangeFilter({ from, to }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => params.set(k, v))
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const applyPreset = (preset: DateRangePreset) => {
    if (preset === 'custom') return
    const { from: f, to: t } = getPresetRange(preset)
    updateParams({ from: f, to: t })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="preset-select" className="text-xs">
          Période rapide
        </Label>
        <Select onValueChange={(v) => applyPreset(v as DateRangePreset)}>
          <SelectTrigger id="preset-select" className="w-40">
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{"Aujourd'hui"}</SelectItem>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="this_month">Ce mois</SelectItem>
            <SelectItem value="this_quarter">Ce trimestre</SelectItem>
            <SelectItem value="custom">Personnalisé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="from-date" className="text-xs">
          Du
        </Label>
        <Input
          id="from-date"
          type="date"
          value={from}
          onChange={(e) => updateParams({ from: e.target.value })}
          className="w-40"
        />
      </div>

      <div>
        <Label htmlFor="to-date" className="text-xs">
          Au
        </Label>
        <Input
          id="to-date"
          type="date"
          value={to}
          onChange={(e) => updateParams({ to: e.target.value })}
          className="w-40"
        />
      </div>
    </div>
  )
}
