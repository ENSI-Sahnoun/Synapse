'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { saveWeeklyScheduleAction } from '@/actions/admin/schedules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { saveWeeklyScheduleSchema, type SaveWeeklyScheduleInput } from '@/utils/zod-schemas/schedule'
import { zodResolver } from '@hookform/resolvers/zod'

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export type WeeklyScheduleDay = { day_of_week: number; start_time: string; end_time: string }

interface WeeklyScheduleFormProps {
  employeeId: string
  existing: WeeklyScheduleDay[]
  existingRole: string
}

function buildDefaultDays(existing: WeeklyScheduleDay[]): WeeklyScheduleDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const found = existing.find((d) => d.day_of_week === i)
    return found ?? { day_of_week: i, start_time: '', end_time: '' }
  })
}

export function WeeklyScheduleForm({ employeeId, existing, existingRole }: WeeklyScheduleFormProps) {
  const form = useForm<SaveWeeklyScheduleInput>({
    resolver: zodResolver(saveWeeklyScheduleSchema) as any,
    defaultValues: {
      employee_id: employeeId,
      role: existingRole,
      days: buildDefaultDays(existing),
    },
  })

  const { execute, status } = useAction(saveWeeklyScheduleAction, {
    onSuccess: () => toast.success('Horaires mis à jour'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
      <input type="hidden" {...form.register('employee_id')} />

      <div className="space-y-1 max-w-xs">
        <Label htmlFor="role">Rôle</Label>
        <Input id="role" {...form.register('role')} />
        {form.formState.errors.role && (
          <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
        )}
      </div>

      <div className="space-y-2">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 text-sm">{label}</span>
            <Input type="time" className="w-32" {...form.register(`days.${i}.start_time`)} />
            <span className="text-sm text-muted-foreground">à</span>
            <Input type="time" className="w-32" {...form.register(`days.${i}.end_time`)} />
            {form.formState.errors.days?.[i]?.end_time && (
              <p className="text-sm text-destructive">
                {form.formState.errors.days[i]?.end_time?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button type="submit" disabled={status === 'executing'}>
        {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer les horaires'}
      </Button>
    </form>
  )
}
