'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { resetNotificationsPeriod } from '@/actions/admin/data-reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function NotificationsResetCard() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)

  const { execute, status } = useAction(resetNotificationsPeriod, {
    onSuccess: () => toast.success('Notifications supprimées pour la période sélectionnée.'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la suppression.'),
  })

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Réinitialiser les notifications</CardTitle>
        <CardDescription>
          Supprime définitivement les notifications enregistrées sur la période choisie. N&apos;affecte pas les
          comptes étudiants.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Du</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Au</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" className="w-fit" disabled={status === 'executing'}>
              {status === 'executing' ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer les notifications du {from} au {to} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Action irréversible. Les notifications enregistrées sur cette période seront définitivement
                supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => execute({ from, to, confirm: `${from}_${to}` })}
              >
                Confirmer la suppression
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
