'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getPlanPriceHistory, type PriceChangeEntry } from '@/data/admin/price-history'

export function PlanPriceHistoryDialog({ planId, planName }: { planId: string; planName: string }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<PriceChangeEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && entries === null) {
      setLoading(true)
      const rows = await getPlanPriceHistory(planId)
      setEntries(rows)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Historique
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historique des prix — {planName}</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!loading && entries && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun changement de prix enregistré.</p>
        )}
        {!loading && entries && entries.length > 0 && (
          <ul className="space-y-2 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex justify-between border-b pb-1">
                <span>{new Date(e.createdAt).toLocaleString('fr-FR')}</span>
                <span className="font-mono">
                  {e.oldPrice !== null ? `${e.oldPrice.toFixed(3)} DT → ` : 'Création: '}
                  {e.newPrice !== null ? `${e.newPrice.toFixed(3)} DT` : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
