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

type Preset = 'today' | 'this_month' | 'last_month' | 'this_year' | 'custom'

function getPresetDates(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  switch (preset) {
    case 'today': {
      const t = fmt(now)
      return { from: t, to: t }
    }
    case 'this_month': {
      const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      const to = fmt(now)
      return { from, to }
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(first), to: fmt(last) }
    }
    case 'this_year': {
      return { from: `${now.getFullYear()}-01-01`, to: fmt(now) }
    }
    default:
      return { from: fmt(now), to: fmt(now) }
  }
}

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

  const applyPreset = (preset: Preset) => {
    if (preset === 'custom') return
    const { from: f, to: t } = getPresetDates(preset)
    updateParams({ from: f, to: t })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="preset-select" className="text-xs">
          Période rapide
        </Label>
        <Select onValueChange={(v) => applyPreset(v as Preset)}>
          <SelectTrigger id="preset-select" className="w-40">
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{"Aujourd'hui"}</SelectItem>
            <SelectItem value="this_month">Ce mois</SelectItem>
            <SelectItem value="last_month">Mois dernier</SelectItem>
            <SelectItem value="this_year">Cette année</SelectItem>
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
