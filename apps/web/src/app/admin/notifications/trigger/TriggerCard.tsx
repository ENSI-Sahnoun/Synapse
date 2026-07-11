'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { triggerNotificationsAction } from '@/actions/admin/trigger-notifications'

export function TriggerCard() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTrigger() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const response = await triggerNotificationsAction({})
      setResult(JSON.stringify(response, null, 2))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Déclencher les notifications manuellement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cette action déclenche immédiatement le traitement des notifications planifiées
          (expirations J-7, J-3, J-1, J-0, J+3). En production, ce traitement s'exécute
          automatiquement chaque jour à 9h00.
        </p>
        <Button onClick={handleTrigger} disabled={loading}>
          {loading ? 'Traitement en cours...' : 'Lancer maintenant'}
        </Button>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">
            <strong>Erreur:</strong> {error}
          </div>
        )}
        {result && (
          <pre className="bg-muted rounded p-4 text-xs overflow-auto max-h-96">{result}</pre>
        )}
      </CardContent>
    </Card>
  )
}
