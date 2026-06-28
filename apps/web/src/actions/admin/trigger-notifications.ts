'use server'

import { adminActionClient } from '@/lib/safe-action'
import { z } from 'zod'

const triggerNotificationsSchema = z.object({})

export const triggerNotificationsAction = adminActionClient
  .schema(triggerNotificationsSchema)
  .action(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      throw new Error('CRON_SECRET environment variable not set')
    }

    try {
      const res = await fetch(`${baseUrl}/api/notifications/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
        },
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`API error: ${res.status} - ${errorText}`)
      }

      const json = await res.json()
      return json
    } catch (error) {
      throw new Error(
        `Failed to trigger notifications: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  })
