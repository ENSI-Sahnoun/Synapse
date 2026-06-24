'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateEmployeeAction } from '@/actions/admin/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2, 'Nom requis'),
  phone: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface EditEmployeeFormProps {
  employee: { id: string; full_name: string; phone: string | null }
  redirectTo: string
}

export function EditEmployeeForm({ employee, redirectTo }: EditEmployeeFormProps) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      id: employee.id,
      full_name: employee.full_name,
      phone: employee.phone ?? '',
    },
  })

  const { execute, status } = useAction(updateEmployeeAction, {
    onSuccess: () => {
      toast.success('Employé mis à jour')
      router.push(redirectTo)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-md">
      <input type="hidden" {...form.register('id')} />

      <div className="space-y-1">
        <Label htmlFor="full_name">Nom complet *</Label>
        <Input id="full_name" {...form.register('full_name')} />
        {form.formState.errors.full_name && (
          <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" {...form.register('phone')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectTo)}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
