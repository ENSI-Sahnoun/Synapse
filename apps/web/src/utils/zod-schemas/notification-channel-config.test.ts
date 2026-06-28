import { describe, it, expect } from 'vitest'
import { upsertChannelConfigSchema } from './notification-channel-config'

describe('upsertChannelConfigSchema', () => {
  it('accepts valid config', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'expiry_7d',
      channel: 'email',
      is_enabled: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid notification type', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'unknown_type',
      channel: 'email',
      is_enabled: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid channel', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'expired',
      channel: 'telegram',
      is_enabled: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing is_enabled', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'expiry_1d',
      channel: 'sms',
    })
    expect(result.success).toBe(false)
  })
})
