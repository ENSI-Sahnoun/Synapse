'use client'

import { useEffect, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createCustomMetricSchema,
  type CreateCustomMetricInput,
} from '@/utils/zod-schemas/custom-metric'
import {
  createCustomMetricAction,
  deleteCustomMetricAction,
} from '@/actions/admin/custom-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { createClient } from '@/supabase-clients/client'

type Metric = {
  id: string
  name: string
  unit: string
  target_value: number | null
  is_dashboard_visible: boolean
}

export default function CustomMetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([])

  async function loadMetrics() {
    const supabase = createClient()
    const { data } = await supabase.from('custom_metrics').select('*').order('created_at')
    setMetrics((data as Metric[]) ?? [])
  }

  useEffect(() => {
    loadMetrics()
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCustomMetricInput>({
    resolver: zodResolver(createCustomMetricSchema) as any,
    defaultValues: { is_dashboard_visible: true, unit: '' },
  })

  const { execute: create, isPending } = useAction(createCustomMetricAction, {
    onSuccess: () => {
      toast.success('Métrique créée')
      reset()
      loadMetrics()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: del } = useAction(deleteCustomMetricAction, {
    onSuccess: () => {
      toast.success('Métrique supprimée')
      loadMetrics()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Métriques personnalisées</h1>
      <p className="text-sm text-muted-foreground">
        Ces métriques s'affichent sur le tableau de bord admin avec une ligne cible.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle métrique</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => create(d))} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="m-name">Nom</Label>
              <Input id="m-name" placeholder="Ex: Nouveaux étudiants ce mois" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-unit">Unité</Label>
              <Input id="m-unit" placeholder="Ex: étudiants, DT, %" {...register('unit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-target">Valeur cible</Label>
              <Input
                id="m-target"
                type="number"
                step="0.01"
                min="0"
                placeholder="Optionnel"
                {...register('target_value')}
              />
              {errors.target_value && (
                <p className="text-xs text-destructive">{errors.target_value.message}</p>
              )}
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Création…' : 'Créer la métrique'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Métriques existantes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead className="text-center">Dashboard</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucune métrique définie.
                  </TableCell>
                </TableRow>
              )}
              {metrics.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.unit || '—'}</TableCell>
                  <TableCell>{m.target_value ?? '—'}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={m.is_dashboard_visible} disabled />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Supprimer cette métrique ?')) del({ id: m.id })
                      }}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
