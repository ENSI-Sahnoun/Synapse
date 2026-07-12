'use client';

import { useAction } from 'next-safe-action/hooks';
import {
  setReservationHoldMinutesExtended,
  setReservationExtendedMinDurationDays,
} from '@/actions/admin/settings';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function ReservationExtendedHoldCard({
  initialMinutes,
  initialMinDays,
}: {
  initialMinutes: number;
  initialMinDays: number;
}) {
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [minDays, setMinDays] = useState(String(initialMinDays));
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);

  const { execute: executeMinutes, isPending: isPendingMinutes } = useAction(
    setReservationHoldMinutesExtended,
    {
      onSuccess: ({ data }) => {
        if (!data?.success) return;
        toast.success(`Durée étendue mise à jour : ${data.minutes} minutes.`);
        setMinutesError(null);
      },
      onError: ({ error }) => {
        const msg =
          error.validationErrors?.minutes?._errors?.[0] ??
          error.serverError ??
          'Erreur lors de la mise à jour.';
        toast.error(msg);
        setMinutesError(msg);
      },
    },
  );

  const { execute: executeDays, isPending: isPendingDays } = useAction(
    setReservationExtendedMinDurationDays,
    {
      onSuccess: ({ data }) => {
        if (!data?.success) return;
        toast.success(`Seuil d'éligibilité mis à jour : ${data.days} jours.`);
        setDaysError(null);
      },
      onError: ({ error }) => {
        const msg =
          error.validationErrors?.days?._errors?.[0] ??
          error.serverError ??
          'Erreur lors de la mise à jour.';
        toast.error(msg);
        setDaysError(msg);
      },
    },
  );

  function handleSaveMinutes() {
    const parsed = parseInt(minutes, 10);
    if (isNaN(parsed) || parsed < 5 || parsed > 240) {
      setMinutesError('La durée doit être entre 5 et 240 minutes.');
      return;
    }
    setMinutesError(null);
    executeMinutes({ minutes: parsed });
  }

  function handleSaveDays() {
    const parsed = parseInt(minDays, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      setDaysError('Le seuil doit être entre 1 et 365 jours.');
      return;
    }
    setDaysError(null);
    executeDays({ days: parsed });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Durée de réservation étendue</CardTitle>
        <CardDescription>
          Les étudiants dont l'abonnement dure au moins le seuil ci-dessous bénéficient d'une
          durée de réservation prolongée au lieu de la durée standard.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="hold-minutes-extended" className="sr-only">
              Durée étendue en minutes
            </Label>
            <Input
              id="hold-minutes-extended"
              type="number"
              min={5}
              max={240}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                setMinutesError(null);
              }}
              disabled={isPendingMinutes}
              className="w-full"
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">minutes</span>
          <Button onClick={handleSaveMinutes} disabled={isPendingMinutes} size="sm">
            {isPendingMinutes ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {minutesError && <p className="text-xs text-red-500">{minutesError}</p>}

        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="reservation-extended-min-days" className="sr-only">
              Seuil en jours
            </Label>
            <Input
              id="reservation-extended-min-days"
              type="number"
              min={1}
              max={365}
              value={minDays}
              onChange={(e) => {
                setMinDays(e.target.value);
                setDaysError(null);
              }}
              disabled={isPendingDays}
              className="w-full"
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">jours minimum</span>
          <Button onClick={handleSaveDays} disabled={isPendingDays} size="sm">
            {isPendingDays ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {daysError && <p className="text-xs text-red-500">{daysError}</p>}
      </CardContent>
    </Card>
  );
}
