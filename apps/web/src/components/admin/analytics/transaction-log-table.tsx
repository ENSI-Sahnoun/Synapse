'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { voidPurchaseAction, voidSubscriptionAction, voidChargeAction } from '@/actions/admin/transactions'
import { EditPurchaseItemDialog } from './EditPurchaseItemDialog'
import { EditSubscriptionDialog } from './EditSubscriptionDialog'
import type { Transaction } from '@/data/admin/analytics/transactions'

const TYPE_LABEL: Record<Transaction['type'], string> = {
  purchase: 'Vente',
  subscription: 'Abonnement',
  charge: 'Charge employé',
}

function describeItems(t: Transaction): string {
  if (t.type === 'purchase') return t.items.map((i) => `${i.qty}× ${i.name}`).join(', ') || '—'
  if (t.type === 'subscription') return t.planName
  return `${t.qty}× ${t.productName}`
}

function amountOf(t: Transaction): number {
  if (t.type === 'purchase') return t.total
  if (t.type === 'subscription') return t.amount
  return t.amount
}

function VoidButton({ transaction }: { transaction: Transaction }) {
  const router = useRouter()
  const onSuccess = () => { toast.success('Transaction annulée'); router.refresh() }
  const onError = ({ error }: { error: { serverError?: string } }) => toast.error(error.serverError ?? 'Erreur')

  const purchaseVoid = useAction(voidPurchaseAction, { onSuccess, onError })
  const subscriptionVoid = useAction(voidSubscriptionAction, { onSuccess, onError })
  const chargeVoid = useAction(voidChargeAction, { onSuccess, onError })

  function handleVoid() {
    if (!confirm('Annuler cette transaction ? Cette action restaure le stock et est enregistrée.')) return
    if (transaction.type === 'purchase') purchaseVoid.execute({ purchase_id: transaction.id })
    if (transaction.type === 'subscription') subscriptionVoid.execute({ subscription_id: transaction.id })
    if (transaction.type === 'charge') chargeVoid.execute({ activity_log_id: transaction.id })
  }

  const executing = purchaseVoid.status === 'executing' || subscriptionVoid.status === 'executing' || chargeVoid.status === 'executing'

  return (
    <Button type="button" variant="destructive" size="sm" disabled={executing} onClick={handleVoid}>
      Annuler
    </Button>
  )
}

export function TransactionLogTable({ transactions }: { transactions: Transaction[] }) {
  const [editing, setEditing] = useState<Transaction | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Heure</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Qui</TableHead>
              <TableHead>Article(s)</TableHead>
              <TableHead className="text-right">Montant (DT)</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune transaction sur la période
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => {
                const voided = t.type !== 'charge' && t.voided
                return (
                  <TableRow key={`${t.type}-${t.id}`} className={voided ? 'opacity-50 line-through' : ''}>
                    <TableCell>{new Date(t.at).toLocaleString('fr-FR')}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABEL[t.type]}</Badge></TableCell>
                    <TableCell>{t.type === 'charge' ? t.who : (t.who ?? 'Anonyme')}</TableCell>
                    <TableCell>{describeItems(t)}</TableCell>
                    <TableCell className="text-right font-mono">{amountOf(t).toFixed(3)}</TableCell>
                    <TableCell className="text-right">
                      {!voided && (
                        <div className="flex gap-2 justify-end">
                          {(t.type === 'purchase' || t.type === 'subscription') && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(t)}>
                              Corriger
                            </Button>
                          )}
                          <VoidButton transaction={t} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
      {editing?.type === 'purchase' && (
        <EditPurchaseItemDialog transaction={editing} onClose={() => setEditing(null)} />
      )}
      {editing?.type === 'subscription' && (
        <EditSubscriptionDialog transaction={editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  )
}
