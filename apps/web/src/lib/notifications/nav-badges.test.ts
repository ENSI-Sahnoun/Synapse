import { describe, it, expect } from 'vitest'
import { countUnreadByHref } from './nav-badges'

describe('countUnreadByHref', () => {
  it('counts unread actionable notifications grouped by their nav href', () => {
    const counts = countUnreadByHref([
      { type: 'reservation_new', is_read: false },
      { type: 'reservation_new', is_read: false },
      { type: 'loyalty_request_new', is_read: false },
      { type: 'seat_swap_request_new', is_read: true },
    ])
    expect(counts).toEqual({
      '/employee/reservations': 2,
      '/employee/loyalty-requests': 1,
    })
  })

  it('ignores non-actionable types entirely', () => {
    const counts = countUnreadByHref([
      { type: 'purchase_completed', is_read: false },
      { type: 'subscription_new', is_read: false },
    ])
    expect(counts).toEqual({})
  })

  it('returns an empty object for an empty list', () => {
    expect(countUnreadByHref([])).toEqual({})
  })
})
