import { describe, it, expect } from 'vitest'
import {
  buildPurchaseMessage,
  buildSubscriptionMessage,
  buildReservationMessage,
  buildLoyaltyRequestMessage,
} from './notification-message-builders'

describe('buildPurchaseMessage', () => {
  it('names the student and items when a student is linked', () => {
    const msg = buildPurchaseMessage({
      studentName: 'Fatma Ben Ali',
      itemsSummary: '2× Café, 1× Croissant',
      totalDt: 12.5,
    })
    expect(msg).toBe('Fatma Ben Ali a acheté 2× Café, 1× Croissant (12.50 DT).')
  })

  it('falls back to an anonymous phrasing with no student name', () => {
    const msg = buildPurchaseMessage({
      studentName: null,
      itemsSummary: '1× Eau',
      totalDt: 1,
    })
    expect(msg).toBe('Vente anonyme : 1× Eau (1.00 DT).')
  })
})

describe('buildSubscriptionMessage', () => {
  it('names the student and plan', () => {
    const msg = buildSubscriptionMessage({
      studentName: 'Fatma Ben Ali',
      planName: 'Mensuel',
      endDateFormatted: '12/08/2026',
    })
    expect(msg).toBe('Fatma Ben Ali a souscrit à la formule "Mensuel" jusqu\'au 12/08/2026.')
  })
})

describe('buildReservationMessage', () => {
  it('names the student and seat', () => {
    const msg = buildReservationMessage({ studentName: 'Fatma Ben Ali', seatLabel: 'A12' })
    expect(msg).toBe('Fatma Ben Ali a réservé la place A12.')
  })
})

describe('buildLoyaltyRequestMessage', () => {
  it('names the student, rule and points', () => {
    const msg = buildLoyaltyRequestMessage({
      studentName: 'Fatma Ben Ali',
      ruleName: 'Café gratuit',
      points: 150,
    })
    expect(msg).toBe('Fatma Ben Ali a demandé la récompense "Café gratuit" (150 pts).')
  })
})
