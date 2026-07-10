'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { CaretUp, CaretDown, Eye, EyeSlash, ChartBar } from '@phosphor-icons/react'
import { setNavOrder } from '@/actions/admin/settings'
import { type NavRole, type ResolvedNavItem } from '@/lib/nav-items'
import { ICON_MAP } from '@/lib/nav-icon-map'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  role: NavRole
  title: string
  description: string
  initialItems: ResolvedNavItem[]
}

export function NavOrderEditor({ role, title, description, initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [dirty, setDirty] = useState(false)

  const { execute, isPending } = useAction(setNavOrder, {
    onSuccess: () => {
      toast.success('Navigation mise à jour.')
      setDirty(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour.')
    },
  })

  function move(key: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.key === key)
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      if (current[target].group !== current[index].group) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
  }

  function toggleHidden(key: string) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, hidden: !item.hidden } : item)))
    setDirty(true)
  }

  const visibleCount = items.filter((item) => !item.hidden).length
  const groups = Array.from(new Set(items.map((item) => item.group)))

  function handleSave() {
    execute({ role, items: items.map(({ key, hidden }) => ({ key, hidden })) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group} className="flex flex-col gap-1.5">
            {groups.length > 1 && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                {group === 'employee' ? 'Employé' : 'Administration'}
              </p>
            )}
            {items
              .filter((item) => item.group === group)
              .map((item) => {
                const Icon = ICON_MAP[item.icon] ?? ChartBar
                const groupItems = items.filter((i) => i.group === group)
                const indexInGroup = groupItems.findIndex((i) => i.key === item.key)
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 rounded-md border p-2"
                    style={{ opacity: item.hidden ? 0.5 : 1 }}
                  >
                    <Icon size={18} />
                    <span className="flex-1 text-sm">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => move(item.key, -1)}
                      disabled={indexInGroup === 0}
                      className="disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={`Monter ${item.label}`}
                    >
                      <CaretUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item.key, 1)}
                      disabled={indexInGroup === groupItems.length - 1}
                      className="disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={`Descendre ${item.label}`}
                    >
                      <CaretDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(item.key)}
                      className="cursor-pointer"
                      aria-label={item.hidden ? `Afficher ${item.label}` : `Masquer ${item.label}`}
                    >
                      {item.hidden ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )
              })}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending || !dirty || visibleCount === 0} size="sm">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {visibleCount === 0 && (
            <p className="text-xs text-red-500">Au moins un élément doit rester visible.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
