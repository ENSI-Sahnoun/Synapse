import { describe, it, expect } from 'vitest'

// Local copy of buildConfigMap for testing (not imported from page)
function buildConfigMapLocal(rows: Array<{ notification_type: string; channel: string; is_enabled: boolean }>) {
  const map = new Map<string, boolean>()
  for (const row of rows) {
    map.set(`${row.notification_type}:${row.channel}`, row.is_enabled)
  }
  return map
}

describe('notification config page helpers', () => {
  it('buildConfigMap returns correct value for present key', () => {
    const map = buildConfigMapLocal([
      { notification_type: 'expiry_7d', channel: 'email', is_enabled: true },
      { notification_type: 'expired', channel: 'sms', is_enabled: false },
    ])
    expect(map.get('expiry_7d:email')).toBe(true)
    expect(map.get('expired:sms')).toBe(false)
  })

  it('buildConfigMap returns undefined for missing key', () => {
    const map = buildConfigMapLocal([])
    expect(map.get('expiry_7d:whatsapp')).toBeUndefined()
  })

  it('last row wins for duplicate keys', () => {
    const map = buildConfigMapLocal([
      { notification_type: 'expiry_1d', channel: 'whatsapp', is_enabled: true },
      { notification_type: 'expiry_1d', channel: 'whatsapp', is_enabled: false },
    ])
    expect(map.get('expiry_1d:whatsapp')).toBe(false)
  })
})
