import { describe, it, expect } from 'vitest'
import { resolveNavOrder, validateNavOrderInput, EMPLOYEE_NAV_ITEMS, ADMIN_NAV_ITEMS } from './nav-items'

describe('resolveNavOrder', () => {
  it('returns the full registry, in order, all visible, when there is no stored value', () => {
    const resolved = resolveNavOrder(EMPLOYEE_NAV_ITEMS, null)
    expect(resolved.map((i) => i.key)).toEqual(EMPLOYEE_NAV_ITEMS.map((i) => i.key))
    expect(resolved.every((i) => i.hidden === false)).toBe(true)
  })

  it('applies stored order and hidden flags', () => {
    const stored = JSON.stringify([
      { key: '/employee/pos', hidden: false },
      { key: '/employee/dashboard', hidden: true },
    ])
    const resolved = resolveNavOrder(EMPLOYEE_NAV_ITEMS, stored)
    expect(resolved[0].key).toBe('/employee/pos')
    expect(resolved.find((i) => i.key === '/employee/dashboard')?.hidden).toBe(true)
  })

  it('drops stored entries whose key no longer exists in the registry', () => {
    const stored = JSON.stringify([{ key: '/employee/deleted-page', hidden: false }])
    const resolved = resolveNavOrder(EMPLOYEE_NAV_ITEMS, stored)
    expect(resolved.some((i) => i.key === '/employee/deleted-page')).toBe(false)
    expect(resolved).toHaveLength(EMPLOYEE_NAV_ITEMS.length)
  })

  it('appends registry items missing from the stored list, visible by default', () => {
    const stored = JSON.stringify([{ key: '/employee/dashboard', hidden: false }])
    const resolved = resolveNavOrder(EMPLOYEE_NAV_ITEMS, stored)
    expect(resolved).toHaveLength(EMPLOYEE_NAV_ITEMS.length)
    expect(resolved.every((i) => i.hidden === false)).toBe(true)
  })

  it('falls back to the default registry on corrupt JSON', () => {
    const resolved = resolveNavOrder(EMPLOYEE_NAV_ITEMS, '{not json')
    expect(resolved.map((i) => i.key)).toEqual(EMPLOYEE_NAV_ITEMS.map((i) => i.key))
  })

  it('ignores duplicate stored entries for the same key', () => {
    const stored = JSON.stringify([
      { key: '/employee/pos', hidden: false },
      { key: '/employee/pos', hidden: true },
    ])
    const resolved = resolveNavOrder(EMPLOYEE_NAV_ITEMS, stored)
    expect(resolved.filter((i) => i.key === '/employee/pos')).toHaveLength(1)
    expect(resolved.find((i) => i.key === '/employee/pos')?.hidden).toBe(false)
  })

  it('keeps group-employee items contiguous before group-admin items regardless of stored interleaving', () => {
    const stored = JSON.stringify([
      { key: '/admin/settings', hidden: false },
      { key: '/admin/dashboard', hidden: false },
    ])
    const resolved = resolveNavOrder(ADMIN_NAV_ITEMS, stored)
    const firstAdminGroupIndex = resolved.findIndex((i) => i.group === 'admin')
    const lastEmployeeGroupIndex = resolved.map((i) => i.group).lastIndexOf('employee')
    expect(lastEmployeeGroupIndex).toBeLessThan(firstAdminGroupIndex)
  })
})

describe('validateNavOrderInput', () => {
  it('throws when an unknown key is present', () => {
    expect(() =>
      validateNavOrderInput('employee', [{ key: '/not/a/real/page', hidden: false }])
    ).toThrow()
  })

  it('throws when every item is hidden', () => {
    const allHidden = EMPLOYEE_NAV_ITEMS.map((i) => ({ key: i.key, hidden: true }))
    expect(() => validateNavOrderInput('employee', allHidden)).toThrow()
  })

  it('passes for a valid partial-hidden list', () => {
    const items = EMPLOYEE_NAV_ITEMS.map((i, idx) => ({ key: i.key, hidden: idx === 0 }))
    expect(() => validateNavOrderInput('employee', items)).not.toThrow()
  })
})
