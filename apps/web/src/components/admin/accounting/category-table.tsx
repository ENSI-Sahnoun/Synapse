'use client'

import { useAction } from 'next-safe-action/hooks'
import {
  toggleAccountCategoryAction,
  deleteAccountCategoryAction,
} from '@/actions/admin/account-categories'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { CategoryFormDialog } from './category-form-dialog'
import type { AccountCategory } from '@/data/admin/accounting'

type Props = { categories: AccountCategory[] }

export function CategoryTable({ categories }: Props) {
  const { execute: toggle } = useAction(toggleAccountCategoryAction, {
    onSuccess: () => toast.success('Statut mis à jour'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: del } = useAction(deleteAccountCategoryAction, {
    onSuccess: () => toast.success('Catégorie supprimée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Nom</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-center">Actif</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((cat) => (
          <TableRow key={cat.id} className={cat.is_active ? '' : 'opacity-50'}>
            <TableCell>
              <Badge variant={cat.type === 'income' ? 'default' : 'secondary'}>
                {cat.type === 'income' ? 'Revenu' : 'Dépense'}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">{cat.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{cat.description ?? '—'}</TableCell>
            <TableCell className="text-center">
              <Switch
                checked={cat.is_active}
                onCheckedChange={(checked) => toggle({ id: cat.id, is_active: checked })}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <CategoryFormDialog
                  existing={cat}
                  trigger={<Button variant="ghost" size="sm">Modifier</Button>}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm('Supprimer cette catégorie ? Impossible si utilisée par des dépenses ou produits.')) {
                      del({ id: cat.id })
                    }
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {categories.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              Aucune catégorie. Créez-en une pour commencer.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
