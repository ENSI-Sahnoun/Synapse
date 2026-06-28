'use client'

import { useOptimistic, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { toggleNotificationChannel } from '@/actions/admin/notification-channel-config'
import type { NotificationType, NotificationChannel } from '@/data/admin/notification-channel-config'

interface ChannelConfigToggleProps {
  notificationType: NotificationType
  channel: NotificationChannel
  isEnabled: boolean
}

export function ChannelConfigToggle({
  notificationType,
  channel,
  isEnabled,
}: ChannelConfigToggleProps) {
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(isEnabled)
  const [isPending, startTransition] = useTransition()

  function handleChange(checked: boolean) {
    startTransition(async () => {
      setOptimisticEnabled(checked)
      const result = await toggleNotificationChannel({
        notification_type: notificationType,
        channel,
        is_enabled: checked,
      })
      if (result?.serverError) {
        toast.error('Échec de la mise à jour. Veuillez réessayer.')
        throw new Error(result.serverError)
      }
    })
  }

  return (
    <Switch
      checked={optimisticEnabled}
      onCheckedChange={handleChange}
      disabled={isPending}
      aria-label={`${channel} pour ${notificationType}`}
    />
  )
}
