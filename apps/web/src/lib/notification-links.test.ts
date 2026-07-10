import { describe, it, expect } from 'vitest'
import { resolveNotificationHref } from './notification-links'

describe('resolveNotificationHref', () => {
  it('prefers a stored link over the static type route', () => {
    const href = resolveNotificationHref({ type: 'reservation_new', link: '/employee/reservations?highlight=abc' })
    expect(href).toBe('/employee/reservations?highlight=abc')
  })

  it('falls back to the static per-type route when link is null', () => {
    const href = resolveNotificationHref({ type: 'reservation_new', link: null })
    expect(href).toBe('/employee/reservations')
  })

  it('falls back to the static per-type route when link is undefined', () => {
    const href = resolveNotificationHref({ type: 'loyalty_request_new' })
    expect(href).toBe('/employee/loyalty-requests')
  })

  it('returns null for an unmapped type with no stored link', () => {
    const href = resolveNotificationHref({ type: 'announcement_new' })
    expect(href).toBeNull()
  })
})
