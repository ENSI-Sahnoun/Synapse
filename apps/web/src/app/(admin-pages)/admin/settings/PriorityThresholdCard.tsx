'use client';

import { useAction } from 'next-safe-action/hooks';
import { setPriorityMinDurationDays } from '@/actions/admin/settings';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function PriorityThresholdCard({ initialDays }: { initialDays: number }) {
  const [days, setDays] = useState(String(initialDays));
  const [validationError, setValidationError] = useState<string | null>(null);

  const { execute, isPending } = useAction(setPriorityMinDurationDays, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Seuil de priorité mis à jour : ${data.days} jours.`);
      setValidationError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.days?._errors?.[0] ??
        error.serverError ??
        'Erreur lors de la mise à jour.';
      toast.error(msg);
      setValidationError(msg);
    },
  });

  function handleSave() {
    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      setValidationError('Le seuil doit être entre 1 et 365 jours.');
      return;
    }
    setValidationError(null);
    execute({ days: parsed });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seuil de priorité (mode examen)</CardTitle>
        <CardDescription>
          Les abonnements d'une durée supérieure ou égale à ce seuil sont considérés prioritaires
          en mode examen — ces étudiants passent devant les abonnements courts dans la file d'attente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="priority-days" className="sr-only">
              Seuil en jours
            </Label>
            <Input
              id="priority-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setValidationError(null);
              }}
              disabled={isPending}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">jours</span>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {validationError && (
          <p className="text-xs text-red-500">{validationError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Exemple : valeur = 30 → les abonnements mensuels et au-delà sont prioritaires.
        </p>
      </CardContent>
    </Card>
  );
}
