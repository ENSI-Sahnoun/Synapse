'use client'

import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createExpenseSchema, type CreateExpenseInput } from '@/utils/zod-schemas/expense'
import { createExpenseAction } from '@/actions/admin/expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  categories: AccountCategory[]
  onSuccess?: () => void
}

export function ExpenseForm({ categories, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const { execute, isPending } = useAction(createExpenseAction, {
    onSuccess: () => {
      toast.success('Dépense enregistrée')
      reset()
      onSuccess?.()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erreur lors de l'enregistrement")
    },
  })

  const onSubmit = (data: CreateExpenseInput) => execute(data)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="account_category_id">Catégorie</Label>
          <Select onValueChange={(v) => setValue('account_category_id', v)}>
            <SelectTrigger id="account_category_id">
              <SelectValue placeholder="Choisir une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.account_category_id && (
            <p className="text-xs text-destructive">{errors.account_category_id.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register('date')} />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" placeholder="Ex: Facture électricité juin" {...register('description')} />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="amount_dt">Montant (DT)</Label>
          <Input
            id="amount_dt"
            type="number"
            step="0.001"
            min="0"
            placeholder="0.000"
            {...register('amount_dt')}
          />
          {errors.amount_dt && (
            <p className="text-xs text-destructive">{errors.amount_dt.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement…' : 'Ajouter la dépense'}
      </Button>
    </form>
  )
}
