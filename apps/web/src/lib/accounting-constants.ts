/**
 * Fixed ids for system-generated accounting categories.
 *
 * These are seeded with hardcoded uuids (not `uuid_generate_v4()`) so SQL CHECK
 * constraints can reference them without a subquery — see
 * `20260710000002_cash_discrepancy_expense.sql`, where the cash-discrepancy
 * category is the sole exemption from the `amount_dt >= 0` constraint.
 *
 * Always match on these ids, never on the French display name: the name is
 * user-editable from /admin/accounting/categories, and name-matching silently
 * changes reporting behaviour the moment someone renames a category.
 */
export const CASH_DISCREPANCY_CATEGORY_ID = '00000000-0000-0000-0000-0000000000ec'
