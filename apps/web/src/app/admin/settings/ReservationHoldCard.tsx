'use client';

import { useAction } from 'next-safe-action/hooks';
import { setReservationHoldMinutes } from '@/actions/admin/settings';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function ReservationHoldCard({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [validationError, setValidationError] = useState<string | null>(null);

  const { execute, isPending } = useAction(setReservationHoldMinutes, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Durée de réservation mise à jour : ${data.minutes} minutes.`);
      setValidationError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.minutes?._errors?.[0] ??
        error.serverError ??
        'Erreur lors de la mise à jour.';
      toast.error(msg);
      setValidationError(msg);
    },
  });

  function handleSave() {
    const parsed = parseInt(minutes, 10);
    if (isNaN(parsed) || parsed < 5 || parsed > 120) {
      setValidationError('La durée doit être entre 5 et 120 minutes.');
      return;
    }
    setValidationError(null);
    execute({ minutes: parsed });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Durée de réservation</CardTitle>
        <CardDescription>
          Durée pendant laquelle une réservation reste active avant expiration automatique.
          Entre 5 et 120 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="hold-minutes" className="sr-only">
              Durée en minutes
            </Label>
            <Input
              id="hold-minutes"
              type="number"
              min={5}
              max={120}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                setValidationError(null);
              }}
              disabled={isPending}
              className="w-full"
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">minutes</span>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {validationError && (
          <p className="text-xs text-red-500">{validationError}</p>
        )}
      </CardContent>
    </Card>
  );
}
