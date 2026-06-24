import { describe, it, expect } from 'vitest'
import { createStudentSchema } from './student'

describe('createStudentSchema', () => {
  it('passes with valid data', () => {
    const result = createStudentSchema.safeParse({
      full_name: 'Ahmed Ben Ali',
      phone: '22334455',
      email: 'ahmed@example.com',
      university: 'ISIMS',
      study_level: 'Licence 3',
    })
    expect(result.success).toBe(true)
  })

  it('fails when full_name is too short', () => {
    const result = createStudentSchema.safeParse({ full_name: 'A' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Nom requis (min 2 caractères)')
  })

  it('allows empty optional fields', () => {
    const result = createStudentSchema.safeParse({ full_name: 'Ali Trabelsi' })
    expect(result.success).toBe(true)
  })
})
