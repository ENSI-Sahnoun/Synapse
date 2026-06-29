'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createAccountCategorySchema,
  type CreateAccountCategoryInput,
} from '@/utils/zod-schemas/account-category'
import {
  createAccountCategoryAction,
  updateAccountCategoryAction,
} from '@/actions/admin/account-categories'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { AccountCategory } from '@/data/admin/accounting'

type Props = {
  existing?: AccountCategory
  trigger?: React.ReactNode
}

export function CategoryFormDialog({ existing, trigger }: Props) {
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateAccountCategoryInput>({
    resolver: zodResolver(createAccountCategorySchema),
    defaultValues: existing
      ? { type: existing.type, name: existing.name, description: existing.description ?? '' }
      : {},
  })

  const { execute: create, isPending: creating } = useAction(createAccountCategoryAction, {
    onSuccess: () => { toast.success('Catégorie créée'); reset(); setOpen(false) },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: update, isPending: updating } = useAction(updateAccountCategoryAction, {
    onSuccess: () => { toast.success('Catégorie mise à jour'); setOpen(false) },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const onSubmit = (data: CreateAccountCategoryInput) => {
    if (existing) update({ id: existing.id, ...data })
    else create(data)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{existing ? 'Modifier' : 'Nouvelle catégorie'}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Modifier la catégorie' : 'Nouvelle catégorie de compte'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select defaultValue={existing?.type} onValueChange={(v) => setValue('type', v as 'income' | 'expense')}>
              <SelectTrigger>
                <SelectValue placeholder="Revenu ou dépense ?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Revenu</SelectItem>
                <SelectItem value="expense">Dépense</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat-name">Nom</Label>
            <Input id="cat-name" placeholder="Ex: Loyer" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat-description">Description (optionnel)</Label>
            <Textarea id="cat-description" rows={2} placeholder="Détails supplémentaires…" {...register('description')} />
          </div>

          <Button type="submit" disabled={creating || updating} className="w-full">
            {creating || updating ? 'Enregistrement…' : existing ? 'Mettre à jour' : 'Créer la catégorie'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
