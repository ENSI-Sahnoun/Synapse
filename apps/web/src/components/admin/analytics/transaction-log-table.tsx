'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { voidPurchaseAction, voidSubscriptionAction, voidChargeAction } from '@/actions/admin/transactions'
import type { Transaction } from '@/data/admin/analytics/transactions'
import { cn } from '@/lib/utils'

function formatWhen(at: string) {
  return new Date(at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function typeBadge(type: Transaction['type']) {
  switch (type) {
    case 'purchase':
      return <Badge variant="outline">Achat</Badge>
    case 'subscription':
      return <Badge variant="outline">Abonnement</Badge>
    case 'charge':
      return <Badge variant="outline">Charge employé</Badge>
  }
}

function describe(tx: Transaction) {
  switch (tx.type) {
    case 'purchase':
      return tx.items.map((i) => `${i.name} ×${i.qty}`).join(', ') || 'Achat'
    case 'subscription':
      return tx.planName
    case 'charge':
      return `${tx.productName} ×${tx.qty}`
  }
}

function amount(tx: Transaction) {
  return tx.type === 'purchase' ? tx.total : tx.type === 'subscription' ? tx.amount : tx.amount
}

export function TransactionLogTable({ transactions }: { transactions: Transaction[] }) {
  const [pending, setPending] = useState<string | null>(null)

  const { execute: execVoidPurchase } = useAction(voidPurchaseAction, {
    onSuccess: () => toast.success('Achat annulé'),
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'annulation"),
    onSettled: () => setPending(null),
  })
  const { execute: execVoidSubscription } = useAction(voidSubscriptionAction, {
    onSuccess: () => toast.success('Abonnement annulé'),
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'annulation"),
    onSettled: () => setPending(null),
  })
  const { execute: execVoidCharge } = useAction(voidChargeAction, {
    onSuccess: () => toast.success('Charge annulée'),
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'annulation"),
    onSettled: () => setPending(null),
  })

  function confirmVoid(tx: Transaction) {
    setPending(tx.id)
    if (tx.type === 'purchase') execVoidPurchase({ purchase_id: tx.id })
    else if (tx.type === 'subscription') execVoidSubscription({ subscription_id: tx.id })
    else execVoidCharge({ activity_log_id: tx.id })
  }

  if (transactions.length === 0) {
    return <p className="text-center text-muted-foreground">Aucune transaction sur la période</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Détail</TableHead>
          <TableHead className="text-right">Montant (DT)</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const voided = tx.type !== 'charge' && tx.voided
          return (
            <TableRow key={`${tx.type}-${tx.id}`} className={cn(voided && 'text-muted-foreground opacity-60')}>
              <TableCell className={cn(voided && 'line-through')}>{formatWhen(tx.at)}</TableCell>
              <TableCell>{typeBadge(tx.type)}</TableCell>
              <TableCell className={cn(voided && 'line-through')}>{tx.who ?? '—'}</TableCell>
              <TableCell className={cn(voided && 'line-through')}>{describe(tx)}</TableCell>
              <TableCell className={cn('text-right font-mono', voided && 'line-through')}>
                {amount(tx).toFixed(3)}
              </TableCell>
              <TableCell>
                {voided ? (
                  <Badge variant="secondary">Annulé</Badge>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={pending === tx.id}>
                        Annuler
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Annuler cette transaction ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Action irréversible. {tx.type === 'purchase' && 'Le stock sera restitué. '}
                          La ligne restera visible dans le journal, barrée.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Retour</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmVoid(tx)}>Confirmer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
