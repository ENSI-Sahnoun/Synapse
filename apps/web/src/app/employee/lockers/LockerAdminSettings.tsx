'use client';

import { useAction } from 'next-safe-action/hooks';
import { setLockerMinDurationDays, setLockerFeeDt, setLockerReminderDelayDays } from '@/actions/admin/settings';
import { toast } from 'sonner';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function LockerAdminSettings({
  initialDays,
  initialFeeDt,
  initialReminderDelayDays,
}: {
  initialDays: number;
  initialFeeDt: number;
  initialReminderDelayDays: number;
}) {
  const [days, setDays] = useState(String(initialDays));
  const [daysError, setDaysError] = useState<string | null>(null);
  const [fee, setFee] = useState(String(initialFeeDt));
  const [feeError, setFeeError] = useState<string | null>(null);
  const [reminderDays, setReminderDays] = useState(String(initialReminderDelayDays));
  const [reminderError, setReminderError] = useState<string | null>(null);

  const { execute: saveDays, isPending: savingDays } = useAction(setLockerMinDurationDays, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Durée minimale mise à jour : ${data.days} jours.`);
      setDaysError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.days?._errors?.[0] ?? error.serverError ?? 'Erreur lors de la mise à jour.';
      toast.error(msg);
      setDaysError(msg);
    },
  });

  const { execute: saveFee, isPending: savingFee } = useAction(setLockerFeeDt, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Tarif du casier mis à jour : ${data.amount_dt} DT.`);
      setFeeError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.amount_dt?._errors?.[0] ?? error.serverError ?? 'Erreur lors de la mise à jour.';
      toast.error(msg);
      setFeeError(msg);
    },
  });

  const { execute: saveReminder, isPending: savingReminder } = useAction(setLockerReminderDelayDays, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Délai de rappel mis à jour : ${data.days} jour(s).`);
      setReminderError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.days?._errors?.[0] ?? error.serverError ?? 'Erreur lors de la mise à jour.';
      toast.error(msg);
      setReminderError(msg);
    },
  });

  function handleSaveReminder() {
    const parsed = parseInt(reminderDays, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 30) {
      setReminderError('Le délai doit être entre 0 et 30 jours.');
      return;
    }
    setReminderError(null);
    saveReminder({ days: parsed });
  }

  function handleSaveDays() {
    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      setDaysError('La durée doit être entre 1 et 365 jours.');
      return;
    }
    setDaysError(null);
    saveDays({ days: parsed });
  }

  function handleSaveFee() {
    const parsed = parseFloat(fee);
    if (isNaN(parsed) || parsed < 0 || parsed > 1000) {
      setFeeError('Le tarif doit être entre 0 et 1000 DT.');
      return;
    }
    setFeeError(null);
    saveFee({ amount_dt: parsed });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Label htmlFor="locker-min-days" className="text-xs text-muted-foreground">
          Durée minimale d&apos;abonnement requise pour être éligible
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="locker-min-days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              setDaysError(null);
            }}
            disabled={savingDays}
            className="h-8"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">jours</span>
          <Button onClick={handleSaveDays} disabled={savingDays} size="sm">
            {savingDays ? '…' : 'OK'}
          </Button>
        </div>
        {daysError && <p className="text-xs text-red-500">{daysError}</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Label htmlFor="locker-fee" className="text-xs text-muted-foreground">
          Tarif facturé à l&apos;attribution d&apos;un casier (non facturé lors d&apos;un échange)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="locker-fee"
            type="number"
            min={0}
            max={1000}
            step="0.001"
            value={fee}
            onChange={(e) => {
              setFee(e.target.value);
              setFeeError(null);
            }}
            disabled={savingFee}
            className="h-8"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">DT</span>
          <Button onClick={handleSaveFee} disabled={savingFee} size="sm">
            {savingFee ? '…' : 'OK'}
          </Button>
        </div>
        {feeError && <p className="text-xs text-red-500">{feeError}</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Label htmlFor="locker-reminder-days" className="text-xs text-muted-foreground">
          Rappel de libération du casier (jours après expiration de l&apos;abonnement)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="locker-reminder-days"
            type="number"
            min={0}
            max={30}
            value={reminderDays}
            onChange={(e) => {
              setReminderDays(e.target.value);
              setReminderError(null);
            }}
            disabled={savingReminder}
            className="h-8"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">jours</span>
          <Button onClick={handleSaveReminder} disabled={savingReminder} size="sm">
            {savingReminder ? '…' : 'OK'}
          </Button>
        </div>
        {reminderError && <p className="text-xs text-red-500">{reminderError}</p>}
      </div>
    </div>
  );
}
