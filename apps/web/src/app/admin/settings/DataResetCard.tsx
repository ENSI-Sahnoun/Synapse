'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  title: string
  description: string
  exportUrl?: (from: string, to: string) => string
  isExecuting: boolean
  onDelete: (args: { from: string; to: string; confirm: string; exportToken: string }) => void
}

export function DataResetCard({ title, description, exportUrl, isExecuting, onDelete }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const [exportToken, setExportToken] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [exporting, setExporting] = useState(false)

  const periodKey = `${from}_${to}`
  const requiresExport = !!exportUrl
  const exportSatisfied = !requiresExport || exportToken !== null

  function handlePeriodChange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom)
    setTo(nextTo)
    setExportToken(null)
    setConfirmText('')
  }

  async function handleExport() {
    if (!exportUrl) return
    setExporting(true)
    try {
      const res = await fetch(exportUrl(from, to))
      if (!res.ok) throw new Error("Échec de l'export")
      const token = res.headers.get('X-Export-Token')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${from}-${to}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setExportToken(token)
      toast.success('Export PDF téléchargé.')
    } catch {
      toast.error("Échec de l'export PDF.")
    } finally {
      setExporting(false)
    }
  }

  const canDelete = exportSatisfied && confirmText === periodKey && !isExecuting

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Du</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => handlePeriodChange(e.target.value, to)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Au</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => handlePeriodChange(from, e.target.value)}
              className="w-40"
            />
          </div>
          {requiresExport && (
            <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Export en cours…' : exportSatisfied ? 'Export exporté ✓' : 'Exporter PDF (requis)'}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Tapez <code className="font-mono">{periodKey}</code> pour confirmer
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={periodKey}
            className="w-64 font-mono"
          />
        </div>

        <Button
          type="button"
          variant="destructive"
          disabled={!canDelete}
          onClick={() => onDelete({ from, to, confirm: confirmText, exportToken: exportToken ?? '' })}
          className="w-fit"
        >
          {isExecuting ? 'Suppression…' : 'Supprimer définitivement'}
        </Button>
      </CardContent>
    </Card>
  )
}
