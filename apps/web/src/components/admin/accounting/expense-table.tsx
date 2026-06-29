'use client'

import { useAction } from 'next-safe-action/hooks'
import { deleteExpenseAction } from '@/actions/admin/expenses'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { ExpenseRow } from '@/data/admin/accounting'

type Props = { expenses: ExpenseRow[] }

export function ExpenseTable({ expenses }: Props) {
  const { execute } = useAction(deleteExpenseAction, {
    onSuccess: () => toast.success('Dépense supprimée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (expenses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune dépense pour cette période.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Montant (DT)</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(e.date).toLocaleDateString('fr-FR')}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{e.account_category.name}</Badge>
            </TableCell>
            <TableCell>{e.description}</TableCell>
            <TableCell className="text-right font-mono">
              {e.amount_dt.toFixed(3)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm('Supprimer cette dépense ?')) execute({ id: e.id })
                }}
              >
                Supprimer
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
