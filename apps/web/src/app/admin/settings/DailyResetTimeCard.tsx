'use client';

import { useAction } from 'next-safe-action/hooks';
import { setDailyResetTime } from '@/actions/admin/settings';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function DailyResetTimeCard({ initialTime }: { initialTime: string }) {
  const [time, setTime] = useState(initialTime);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { execute, isPending } = useAction(setDailyResetTime, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Heure de réinitialisation mise à jour : ${data.time}.`);
      setValidationError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.time?._errors?.[0] ??
        error.serverError ??
        'Erreur lors de la mise à jour.';
      toast.error(msg);
      setValidationError(msg);
    },
  });

  function handleSave() {
    if (!TIME_REGEX.test(time)) {
      setValidationError('Format HH:MM requis.');
      return;
    }
    setValidationError(null);
    execute({ time });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réinitialisation quotidienne</CardTitle>
        <CardDescription>
          Chaque jour à cette heure : tous les étudiants sont sortis, toutes les caisses
          ouvertes sont clôturées, toutes les réservations actives sont annulées, et toutes
          les notifications sont marquées comme lues.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="daily-reset-time" className="sr-only">
              Heure de réinitialisation
            </Label>
            <Input
              id="daily-reset-time"
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setValidationError(null);
              }}
              disabled={isPending}
              className="w-full"
            />
          </div>
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
