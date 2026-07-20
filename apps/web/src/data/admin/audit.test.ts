import { describe, it, expect } from 'vitest'
import { summariseChange } from './audit'

describe('summariseChange', () => {
  it('reports only the fields that actually differ', () => {
    expect(
      summariseChange(
        { id: 'a', amount_dt: '50.000', description: 'Loyer' },
        { id: 'a', amount_dt: '75.000', description: 'Loyer' },
      ),
    ).toEqual([{ field: 'amount_dt', before: '50.000', after: '75.000' }])
  })

  // The audit trigger writes `to_jsonb(NEW)` on every write, so `updated_at`
  // differs on 100% of updates and would drown the one field that changed.
  it('ignores updated_at', () => {
    expect(
      summariseChange(
        { amount_dt: '50.000', updated_at: '2026-07-01T10:00:00Z' },
        { amount_dt: '50.000', updated_at: '2026-07-02T10:00:00Z' },
      ),
    ).toEqual([])
  })

  it('returns nothing when the row is untouched', () => {
    const row = { id: 'a', amount_dt: '50.000', restocked: false }
    expect(summariseChange(row, { ...row })).toEqual([])
  })

  // numeric columns come back as strings and integers as numbers; the same
  // value in two representations is not a change worth showing.
  it('treats numerically equal string and number values as unchanged', () => {
    expect(summariseChange({ quantity: 3 }, { quantity: '3' })).toEqual([])
  })

  it('distinguishes false from null rather than collapsing both', () => {
    expect(summariseChange({ restocked: null }, { restocked: false })).toEqual([
      { field: 'restocked', before: null, after: false },
    ])
  })

  it('compares nested jsonb structurally', () => {
    expect(summariseChange({ meta: { a: 1 } }, { meta: { a: 1 } })).toEqual([])
    expect(summariseChange({ meta: { a: 1 } }, { meta: { a: 2 } })).toEqual([
      { field: 'meta', before: { a: 1 }, after: { a: 2 } },
    ])
  })

  it('renders an insert as every field appearing from null', () => {
    expect(summariseChange(null, { amount_dt: '50.000', reason: 'Erreur de caisse' })).toEqual([
      { field: 'amount_dt', before: null, after: '50.000' },
      { field: 'reason', before: null, after: 'Erreur de caisse' },
    ])
  })

  it('renders a delete as every field disappearing to null', () => {
    expect(summariseChange({ amount_dt: '50.000' }, null)).toEqual([
      { field: 'amount_dt', before: '50.000', after: null },
    ])
  })

  it('includes fields present on only one side', () => {
    expect(summariseChange({ old_col: 'x' }, { new_col: 'y' })).toEqual([
      { field: 'new_col', before: null, after: 'y' },
      { field: 'old_col', before: 'x', after: null },
    ])
  })

  it('handles two empty snapshots', () => {
    expect(summariseChange(null, null)).toEqual([])
  })
})
