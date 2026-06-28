import { describe, it, expect } from 'vitest'
import {
  buildExpiryWarningWhatsApp,
  buildExpiredWhatsApp,
  buildRenewalReminderWhatsApp,
} from './whatsapp'

describe('whatsapp templates', () => {
  it('expiry warning mentions days left', () => {
    const msg = buildExpiryWarningWhatsApp({
      studentName: 'Youssef',
      planName: 'Mensuel',
      expiryDate: '30/06/2026',
      daysLeft: 7,
    })
    expect(msg.body).toContain('7 jour')
    expect(msg.body).toContain('Youssef')
    expect(msg.body).toContain('Mensuel')
  })

  it('expired message includes expiry date', () => {
    const msg = buildExpiredWhatsApp({
      studentName: 'Rima',
      planName: 'Hebdomadaire',
      expiryDate: '20/06/2026',
    })
    expect(msg.body).toContain('20/06/2026')
  })

  it('renewal reminder mentions 3 days', () => {
    const msg = buildRenewalReminderWhatsApp({
      studentName: 'Bilel',
      planName: 'Mensuel',
      expiryDate: '17/06/2026',
    })
    expect(msg.body).toContain('3 jours')
  })
})
