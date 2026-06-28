import { describe, it, expect } from 'vitest'
import { buildExpiryWarningEmail, buildExpiredEmail, buildRenewalReminderEmail } from './email'

describe('email templates', () => {
  it('expiry warning subject includes days remaining', () => {
    const email = buildExpiryWarningEmail({
      studentName: 'Ahmed',
      planName: 'Mensuel',
      expiryDate: '30/06/2026',
      daysLeft: 7,
    })
    expect(email.subject).toContain('7 jour')
    expect(email.html).toContain('Ahmed')
    expect(email.html).toContain('Mensuel')
  })

  it('expired email body mentions expiry date', () => {
    const email = buildExpiredEmail({
      studentName: 'Fatma',
      planName: 'Hebdomadaire',
      expiryDate: '20/06/2026',
    })
    expect(email.subject).toContain('expiré')
    expect(email.html).toContain('20/06/2026')
  })

  it('renewal reminder subject correct', () => {
    const email = buildRenewalReminderEmail({
      studentName: 'Mohamed',
      planName: 'Mensuel',
      expiryDate: '17/06/2026',
    })
    expect(email.subject).toContain('renouvellement')
  })
})
