import { describe, it, expect } from 'vitest'
import { buildExpiredSms, buildExpiryWarningSms } from './sms'

describe('sms templates', () => {
  it('expired sms mentions expiry date', () => {
    const sms = buildExpiredSms({ studentName: 'Ali', expiryDate: '20/06/2026' })
    expect(sms.body).toContain('20/06/2026')
    expect(sms.body).toContain('Ali')
    expect(sms.body.length).toBeLessThanOrEqual(160)
  })

  it('expiry warning sms includes days left', () => {
    const sms = buildExpiryWarningSms({
      studentName: 'Sara',
      expiryDate: '30/06/2026',
      daysLeft: 3,
    })
    expect(sms.body).toContain('3j')
    expect(sms.body.length).toBeLessThanOrEqual(160)
  })
})
