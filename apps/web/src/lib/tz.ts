// Single source of truth for "what day is it" across every financial query.
//
// Before this module three conventions coexisted: `date-range.ts` used the
// server's local timezone (UTC on Vercel), `analytics/overview.ts` used an
// inline `Africa/Tunis` Intl formatter, and everything in `accounting.ts`
// concatenated naive `'T00:00:00'` strings that PostgREST resolved as UTC.
// The business runs on Africa/Tunis, so the first hour of every business day
// was being bucketed into the previous day — and into the previous *month* on
// the 1st, which is the range the dashboard defaults to.
//
// Tunisia has had no DST since 2009 (permanent UTC+1), but the offset is
// derived rather than hardcoded so the helpers stay correct if that changes.

export const BUSINESS_TIMEZONE = 'Africa/Tunis'

const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: BUSINESS_TIMEZONE })

/** Calendar date (YYYY-MM-DD) that the given instant falls on in Tunis. */
export function tunisDate(d: Date = new Date()): string {
  return dayFormatter.format(d)
}

/**
 * Offset of `Africa/Tunis` from UTC at the given instant, as `+01:00`.
 * Derived by formatting the instant in both zones and diffing.
 */
function tunisOffset(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  // `Date.UTC` of the wall-clock reading in Tunis, minus the real instant,
  // is exactly the offset.
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  )
  const minutes = Math.round((asUtc - at.getTime()) / 60_000)
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/**
 * Start of `date` (YYYY-MM-DD) in Tunis, as an offset-qualified ISO string
 * PostgREST compares correctly against `timestamptz`.
 * `tunisDayStart('2026-07-20')` → `'2026-07-20T00:00:00+01:00'`
 */
export function tunisDayStart(date: string): string {
  // Midday probe: far from any DST edge, so the offset it yields is the one
  // that applies to the bulk of the day.
  const probe = new Date(`${date}T12:00:00Z`)
  return `${date}T00:00:00${tunisOffset(probe)}`
}

/**
 * Exclusive upper bound: start of the day *after* `date`, in Tunis.
 *
 * Always pair with `.lt()`, never `.lte()`. The previous `.lte(to +
 * 'T23:59:59')` pattern silently dropped every row in the final 999 ms of the
 * period, and disagreed with the `< (p_to + 1)` half-open window the SQL RPCs
 * already used — so the same period meant two different things depending on
 * whether the number came from JS or from Postgres.
 */
export function tunisDayEndExclusive(date: string): string {
  const next = new Date(`${date}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return tunisDayStart(dayFormatter.format(next))
}

/** Both bounds of an inclusive `from`..`to` day range, as a half-open interval. */
export function tunisRange(from: string, to: string): { start: string; endExclusive: string } {
  return { start: tunisDayStart(from), endExclusive: tunisDayEndExclusive(to) }
}

/** Add `days` to a YYYY-MM-DD date, staying in calendar-date space. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return dayFormatter.format(d)
}

/** Inclusive count of days between two YYYY-MM-DD dates. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  return Math.round((b - a) / 86_400_000) + 1
}

/** Every YYYY-MM-DD from `from` to `to` inclusive. */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  return days
}

/**
 * Money rounded to the millime (3 decimals).
 *
 * Amounts are `numeric` in Postgres but arrive as JS doubles, so summing a few
 * hundred of them drifts into artefacts like `1234.5670000000002` — which then
 * renders through `.toFixed(3)` and makes a reconciled balance look off.
 * Apply at aggregation boundaries, not on every addition.
 */
export function roundDt(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}
