# Student Rewards Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standalone animated `/student/rewards` page merging the monthly leaderboard and loyalty points system; dashboard keeps only a compact teaser.

**Architecture:** Server component page fetches all data with existing fetchers and passes plain props to a client `RewardsHub` (tab state + panels). Old `/student/loyalty` route redirects to the new page; dashboard's `LeaderboardCard` is replaced by a `GamificationTeaser`.

**Tech Stack:** Next.js App Router (apps/web), Supabase data layer (existing fetchers, unchanged), `motion` animation library (new dep), Tailwind + `--synapse-*` CSS custom properties, Phosphor icons, vitest, French copy.

## Global Constraints

- All user-facing copy in French, matching tone of existing student pages.
- Reuse existing data fetchers verbatim — no changes to `src/data/student/loyalty.ts` or `src/data/student/leaderboard.ts`.
- Respect `prefers-reduced-motion`: no count-up/shimmer/springs when set (motion's `useReducedMotion`).
- Styling with existing CSS vars (`var(--synapse-…)`, `var(--muted-foreground)`, etc.) + Tailwind utilities; hero palette: `#2b2419 → #4a3b23` gradient, gold `#ffd873`.
- No levels, badges, streaks, confetti (out of scope per spec).
- Repo: `/home/sah/Synapse`, branch `feat/student-scoreboard`, package manager pnpm. Web app dir: `apps/web`.
- Commands run from `apps/web`: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

---

### Task 1: Install `motion` + pure helpers (`getNextReward`, `weeklyDelta`)

**Files:**
- Modify: `apps/web/package.json` (dependency added via pnpm)
- Create: `apps/web/src/lib/rewards.ts`
- Test: `apps/web/src/lib/rewards.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type LoyaltyRule = { id: string; name: string; reward_type: string; points_threshold: number; reward_value: number | null }`
  - `getNextReward(balance: number, rules: LoyaltyRule[]): { rule: LoyaltyRule; missing: number; progressPct: number } | null` — cheapest rule with `points_threshold > balance`; `progressPct` = `balance / threshold * 100` clamped 0–100; `null` if no such rule.
  - `weeklyDelta(ledger: { points_delta: number; created_at: string }[], now?: Date): number` — sum of `points_delta` for entries within the last 7 days of `now` (default `new Date()`).

- [ ] **Step 1: Install motion**

```bash
cd /home/sah/Synapse/apps/web && pnpm add motion
```

Expected: `motion` appears in `apps/web/package.json` dependencies.

- [ ] **Step 2: Write failing tests**

Create `apps/web/src/lib/rewards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getNextReward, weeklyDelta, type LoyaltyRule } from './rewards'

const rule = (id: string, threshold: number): LoyaltyRule => ({
  id,
  name: `R${id}`,
  reward_type: 'free_coffee',
  points_threshold: threshold,
  reward_value: null,
})

describe('getNextReward', () => {
  it('returns cheapest unaffordable rule with missing points and progress', () => {
    const rules = [rule('a', 100), rule('b', 500), rule('c', 200)]
    const next = getNextReward(140, rules)
    expect(next?.rule.id).toBe('c')
    expect(next?.missing).toBe(60)
    expect(next?.progressPct).toBe(70)
  })

  it('returns null when all rules affordable', () => {
    expect(getNextReward(600, [rule('a', 100), rule('b', 500)])).toBeNull()
  })

  it('returns null when no rules', () => {
    expect(getNextReward(0, [])).toBeNull()
  })

  it('clamps progress at 0 for zero balance', () => {
    const next = getNextReward(0, [rule('a', 200)])
    expect(next?.progressPct).toBe(0)
    expect(next?.missing).toBe(200)
  })
})

describe('weeklyDelta', () => {
  const now = new Date('2026-07-05T12:00:00Z')
  it('sums entries within last 7 days only', () => {
    const ledger = [
      { points_delta: 30, created_at: '2026-07-04T10:00:00Z' },
      { points_delta: 15, created_at: '2026-06-30T10:00:00Z' },
      { points_delta: -10, created_at: '2026-07-01T10:00:00Z' },
      { points_delta: 99, created_at: '2026-06-01T10:00:00Z' },
    ]
    expect(weeklyDelta(ledger, now)).toBe(35)
  })

  it('returns 0 for empty ledger', () => {
    expect(weeklyDelta([], now)).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd /home/sah/Synapse/apps/web && pnpm test -- rewards
```

Expected: FAIL — cannot resolve `./rewards`.

- [ ] **Step 4: Implement `apps/web/src/lib/rewards.ts`**

```ts
export type LoyaltyRule = {
  id: string
  name: string
  reward_type: string
  points_threshold: number
  reward_value: number | null
}

export type NextReward = { rule: LoyaltyRule; missing: number; progressPct: number }

/** Cheapest active rule the student cannot yet afford, with progress toward it. */
export function getNextReward(balance: number, rules: LoyaltyRule[]): NextReward | null {
  const candidates = rules
    .filter((r) => r.points_threshold > balance)
    .sort((a, b) => a.points_threshold - b.points_threshold)
  const rule = candidates[0]
  if (!rule) return null
  const progressPct = Math.max(0, Math.min(100, (balance / rule.points_threshold) * 100))
  return { rule, missing: rule.points_threshold - balance, progressPct }
}

/** Sum of ledger deltas over the trailing 7 days. */
export function weeklyDelta(
  ledger: { points_delta: number; created_at: string }[],
  now: Date = new Date()
): number {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000
  return ledger
    .filter((e) => new Date(e.created_at).getTime() >= cutoff)
    .reduce((sum, e) => sum + e.points_delta, 0)
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd /home/sah/Synapse/apps/web && pnpm test -- rewards
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/sah/Synapse && git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/rewards.ts apps/web/src/lib/rewards.test.ts && git commit -m "feat: add motion dep and rewards progress helpers"
```

---

### Task 2: `PointsHero` component

**Files:**
- Create: `apps/web/src/app/student/rewards/PointsHero.tsx`

**Interfaces:**
- Consumes: `getNextReward`, `weeklyDelta`, `NextReward` from `@/lib/rewards` (Task 1); `motion`, `useReducedMotion`, `useSpring`, `useTransform` from `motion/react`.
- Produces: `PointsHero({ balance, delta, next }: { balance: number; delta: number; next: NextReward | null })` — client component. Callers compute `delta`/`next` server-side with the Task 1 helpers.

- [ ] **Step 1: Write component**

Create `apps/web/src/app/student/rewards/PointsHero.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import type { NextReward } from '@/lib/rewards'

const GOLD = '#ffd873'
const GOLD_MUTED = '#bfae85'
const LABEL = '#d9c896'

function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const spring = useSpring(reduced ? value : 0, { stiffness: 60, damping: 18 })
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('fr-FR'))
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  if (reduced) return <span>{value.toLocaleString('fr-FR')}</span>
  return <motion.span>{rounded}</motion.span>
}

export function PointsHero({
  balance,
  delta,
  next,
}: {
  balance: number
  delta: number
  next: NextReward | null
}) {
  const reduced = useReducedMotion()
  const [shimmer, setShimmer] = useState(false)
  useEffect(() => {
    if (!reduced) setShimmer(true)
  }, [reduced])

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: 'linear-gradient(140deg, #2b2419, #4a3b23)' }}
    >
      {shimmer && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/3 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent, rgba(255,216,115,0.12), transparent)',
          }}
          initial={{ left: '-40%' }}
          animate={{ left: '120%' }}
          transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
        />
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: LABEL }}>
        Points Synapse
      </p>
      <p className="text-4xl font-extrabold mt-1" style={{ color: GOLD, fontFamily: 'var(--font-display)' }}>
        <AnimatedNumber value={balance} /> ✦
      </p>
      {delta !== 0 && (
        <p className="text-xs mt-1 font-medium" style={{ color: GOLD_MUTED }}>
          {delta > 0 ? '+' : ''}
          {delta} pts cette semaine
        </p>
      )}

      {next && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold mb-1.5" style={{ color: LABEL }}>
            Plus que {next.missing} pts → {next.rule.name}
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: GOLD }}
              initial={{ width: reduced ? `${next.progressPct}%` : 0 }}
              animate={{ width: `${next.progressPct}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/sah/Synapse/apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/sah/Synapse && git add apps/web/src/app/student/rewards/PointsHero.tsx && git commit -m "feat: add PointsHero with animated count-up and next-reward progress"
```

---

### Task 3: `LeaderboardPanel` component

**Files:**
- Create: `apps/web/src/app/student/rewards/LeaderboardPanel.tsx`
- Reference (port logic from, do NOT delete yet): `apps/web/src/app/student/dashboard/LeaderboardCard.tsx`

**Interfaces:**
- Consumes: types from `@/data/student/leaderboard` (`LeaderboardRow`, `LeaderboardConfigRow`, `LeaderboardSettings`, `MyRank`, `LeaderboardCategory`); `motion`, `useReducedMotion` from `motion/react`.
- Produces: `LeaderboardPanel({ rows, myRanks, settings, config }: { rows: LeaderboardRow[]; myRanks: MyRank[]; settings: LeaderboardSettings; config: LeaderboardConfigRow[] })` — client component. Renders `null` if `!settings.enabled` or no enabled categories (parent also hides the tab; double guard is intentional).

- [ ] **Step 1: Write component**

Create `apps/web/src/app/student/rewards/LeaderboardPanel.tsx` (logic ported from `LeaderboardCard.tsx`; keep `formatValue`, `initials`, podium order, prize label identical):

```tsx
'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
  LeaderboardCategory,
} from '@/data/student/leaderboard'

function formatValue(category: LeaderboardCategory, value: number): string {
  if (category === 'visits') return `${Math.round(value)} visites`
  if (category === 'hours') return `${value.toFixed(1)}h`
  return `${value.toFixed(2)} DT`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const PODIUM_HEIGHTS = [64, 96, 48] // px: 2nd, 1st, 3rd
const MEDALS = ['🥈', '🥇', '🥉']

export function LeaderboardPanel({
  rows,
  myRanks,
  settings,
  config,
}: {
  rows: LeaderboardRow[]
  myRanks: MyRank[]
  settings: LeaderboardSettings
  config: LeaderboardConfigRow[]
}) {
  const reduced = useReducedMotion()
  const enabledCats = config.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const [active, setActive] = useState<LeaderboardCategory>(enabledCats[0]?.category ?? 'visits')

  if (!settings.enabled || enabledCats.length === 0) return null

  const activeCfg = enabledCats.find((c) => c.category === active) ?? enabledCats[0]
  const catRows = rows.filter((r) => r.category === active).sort((a, b) => a.rank - b.rank)
  const podium = catRows.filter((r) => r.rank <= 3)
  const rest = catRows.filter((r) => r.rank > 3)
  const mine = myRanks.find((m) => m.category === active)

  const byRank = (n: number) => podium.find((r) => r.rank === n)
  const podiumOrder = [byRank(2), byRank(1), byRank(3)]

  const prizeLabel = settings.prizeSecret
    ? '🎁 Prix mystère'
    : `Fin du mois : 🥇${activeCfg.points_1} · 🥈${activeCfg.points_2} · 🥉${activeCfg.points_3} pts`

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
    >
      <div className="px-5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
          Classement du mois
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{prizeLabel}</p>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 px-5 pt-3 pb-1 overflow-x-auto">
        {enabledCats.map((c) => (
          <button
            key={c.category}
            onClick={() => setActive(c.category)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            style={
              c.category === active
                ? { background: 'var(--synapse-green-500)', color: 'white' }
                : { background: 'white', color: 'var(--synapse-brown-700)' }
            }
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      {podium.length > 0 ? (
        <div className="flex items-end justify-center gap-3 px-5 pt-4">
          {podiumOrder.map((r, i) =>
            r ? (
              <div key={`${active}-${i}`} className="flex flex-col items-center gap-1 flex-1 max-w-[33%]">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold bg-white shadow-sm">
                  {initials(r.full_name)}
                </div>
                <span className="text-[11px] font-semibold text-center truncate w-full" title={r.full_name ?? ''}>
                  {r.full_name ?? 'Anonyme'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatValue(active, r.value)}
                </span>
                <motion.div
                  className="w-full rounded-t-lg flex items-start justify-center pt-1"
                  style={{ background: 'var(--synapse-cream-300)' }}
                  initial={reduced ? { height: PODIUM_HEIGHTS[i] } : { height: 0 }}
                  animate={{ height: PODIUM_HEIGHTS[i] }}
                  transition={{ type: 'spring', stiffness: 160, damping: 20, delay: reduced ? 0 : 0.1 * i }}
                >
                  <span className="text-lg">{MEDALS[i]}</span>
                </motion.div>
              </div>
            ) : (
              <div key={`${active}-${i}`} className="flex-1 max-w-[33%]" />
            )
          )}
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
          Pas encore de classement ce mois-ci.
        </p>
      )}

      {/* Ranks 4+ */}
      {rest.length > 0 && (
        <div className="px-5 pt-4 flex flex-col gap-1.5">
          {rest.map((r, i) => (
            <motion.div
              key={`${active}-${r.student_id}`}
              className="flex items-center justify-between text-sm"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.3 + i * 0.05 }}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold w-5" style={{ color: 'var(--muted-foreground)' }}>#{r.rank}</span>
                <span className="truncate">{r.full_name ?? 'Anonyme'}</span>
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatValue(active, r.value)}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* My rank */}
      <div
        className="mt-4 mx-5 mb-4 rounded-lg px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
      >
        <span className="text-xs font-semibold">Votre position</span>
        <span className="text-sm font-bold">
          {mine && mine.rank ? `#${mine.rank} · ${formatValue(active, mine.value)}` : 'Non classé'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/sah/Synapse/apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/sah/Synapse && git add apps/web/src/app/student/rewards/LeaderboardPanel.tsx && git commit -m "feat: add LeaderboardPanel with animated podium"
```

---

### Task 4: `RewardsPanel` component (moves `RequestButton`)

**Files:**
- Create: `apps/web/src/app/student/rewards/RewardsPanel.tsx`
- Move: `apps/web/src/app/student/loyalty/request-button.tsx` → `apps/web/src/app/student/rewards/request-button.tsx` (content unchanged)

**Interfaces:**
- Consumes: `LoyaltyRule` from `@/lib/rewards`; `RequestButton` (moved, same props `{ ruleId, canRedeem, alreadyPending }`); `motion`, `useReducedMotion` from `motion/react`; `format`/`fr` from date-fns.
- Produces: `RewardsPanel({ balance, rules, pendingRuleIds, requests }: { balance: number; rules: LoyaltyRule[]; pendingRuleIds: string[]; requests: RedemptionRequest[] })` with `type RedemptionRequest = { id: string; status: string; points_used: number; created_at: string; loyalty_rules: { name: string } | null }` exported from this file.

- [ ] **Step 1: Move RequestButton**

```bash
cd /home/sah/Synapse && git mv apps/web/src/app/student/loyalty/request-button.tsx apps/web/src/app/student/rewards/request-button.tsx
```

Note: old loyalty `page.tsx` now has a broken import — fixed in Task 6 when the page becomes a redirect. Typecheck deferred to Step 3 comment below; run typecheck only after Task 6 for the loyalty page, but this task's new file must compile on its own.

- [ ] **Step 2: Write component**

Create `apps/web/src/app/student/rewards/RewardsPanel.tsx`:

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { LoyaltyRule } from '@/lib/rewards'
import { RequestButton } from './request-button'

export type RedemptionRequest = {
  id: string
  status: string
  points_used: number
  created_at: string
  loyalty_rules: { name: string } | null
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  fulfilled: 'Accordée',
  rejected: 'Refusée',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const GOLD = '#c9a227'

function ProgressRing({ pct, unlocked }: { pct: number; unlocked: boolean }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--synapse-cream-300)" strokeWidth="4" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={unlocked ? GOLD : 'var(--synapse-green-500)'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--synapse-brown-700)">
        {Math.floor(Math.min(pct, 100))}%
      </text>
    </svg>
  )
}

export function RewardsPanel({
  balance,
  rules,
  pendingRuleIds,
  requests,
}: {
  balance: number
  rules: LoyaltyRule[]
  pendingRuleIds: string[]
  requests: RedemptionRequest[]
}) {
  const reduced = useReducedMotion()

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
            Aucune récompense active pour le moment.
          </p>
        )}
        {rules.map((rule, i) => {
          const canRedeem = balance >= rule.points_threshold
          const alreadyPending = pendingRuleIds.includes(rule.id)
          const pct = (balance / rule.points_threshold) * 100
          return (
            <motion.div
              key={rule.id}
              className="border rounded-xl p-4 flex items-center gap-4 bg-white"
              style={canRedeem ? { borderColor: GOLD, boxShadow: `0 0 0 1px ${GOLD}` } : { borderColor: 'var(--border-subtle)', opacity: 0.75 }}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: canRedeem ? 1 : 0.75, y: 0 }}
              transition={{ delay: reduced ? 0 : i * 0.06 }}
            >
              <ProgressRing pct={pct} unlocked={canRedeem} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{rule.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {REWARD_TYPE_LABELS[rule.reward_type] ?? rule.reward_type}
                  {rule.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
                </p>
                <p className="text-xs mt-0.5">
                  <span
                    className="font-semibold"
                    style={{ color: canRedeem ? GOLD : 'var(--muted-foreground)' }}
                  >
                    {rule.points_threshold} pts requis
                  </span>
                  {canRedeem && <span className="text-green-600 ml-2">✓ Disponible</span>}
                </p>
              </div>
              <RequestButton ruleId={rule.id} canRedeem={canRedeem} alreadyPending={alreadyPending} />
            </motion.div>
          )
        })}
      </section>

      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">Historique des demandes</h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between text-sm bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <p className="font-medium">{req.loyalty_rules?.name ?? 'Récompense'}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABELS[req.status] ?? req.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

(Skip full typecheck here — old loyalty page import intentionally broken until Task 6.)

```bash
cd /home/sah/Synapse && git add -A apps/web/src/app/student/rewards apps/web/src/app/student/loyalty && git commit -m "feat: add RewardsPanel with progress rings; move RequestButton"
```

---

### Task 5: `HistoryPanel` component

**Files:**
- Create: `apps/web/src/app/student/rewards/HistoryPanel.tsx`

**Interfaces:**
- Consumes: `motion`, `useReducedMotion`; date-fns.
- Produces: `HistoryPanel({ ledger }: { ledger: LedgerEntry[] })` with `type LedgerEntry = { id: string; points_delta: number; reason: string; created_at: string }` exported from this file.

- [ ] **Step 1: Write component**

Create `apps/web/src/app/student/rewards/HistoryPanel.tsx`:

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export type LedgerEntry = {
  id: string
  points_delta: number
  reason: string
  created_at: string
}

const REASON_LABELS: Record<string, string> = {
  subscription: 'Abonnement',
  purchase: 'Achat en magasin',
  redemption: 'Échange de récompense',
}

export function HistoryPanel({ ledger }: { ledger: LedgerEntry[] }) {
  const reduced = useReducedMotion()

  if (ledger.length === 0) {
    return (
      <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
        Aucun point gagné pour le moment. Achetez un abonnement ou un produit pour commencer.
      </p>
    )
  }

  return (
    <div className="divide-y border rounded-xl bg-white overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      {ledger.map((entry, i) => (
        <motion.div
          key={entry.id}
          className="flex items-center justify-between px-4 py-2.5 text-sm"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : i * 0.04 }}
        >
          <div>
            <p>{REASON_LABELS[entry.reason] ?? entry.reason}</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {format(new Date(entry.created_at), 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>
          <span className={`font-semibold ${entry.points_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {entry.points_delta >= 0 ? '+' : ''}{entry.points_delta} pts
          </span>
        </motion.div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/sah/Synapse && git add apps/web/src/app/student/rewards/HistoryPanel.tsx && git commit -m "feat: add HistoryPanel ledger list"
```

---

### Task 6: `RewardsHub`, page, loyalty redirect, nav update

**Files:**
- Create: `apps/web/src/app/student/rewards/RewardsHub.tsx`
- Create: `apps/web/src/app/student/rewards/page.tsx`
- Rewrite: `apps/web/src/app/student/loyalty/page.tsx` (redirect only)
- Modify: `apps/web/src/components/student/StudentBottomNav.tsx` (tab href + icon)

**Interfaces:**
- Consumes: everything from Tasks 1–5 (exact prop signatures above); leaderboard + loyalty fetchers listed in the spec.
- Produces: route `/student/rewards`; `/student/loyalty` server-redirects there.

- [ ] **Step 1: Write `RewardsHub.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
} from '@/data/student/leaderboard'
import type { LoyaltyRule, NextReward } from '@/lib/rewards'
import { PointsHero } from './PointsHero'
import { LeaderboardPanel } from './LeaderboardPanel'
import { RewardsPanel, type RedemptionRequest } from './RewardsPanel'
import { HistoryPanel, type LedgerEntry } from './HistoryPanel'

type TabId = 'leaderboard' | 'rewards' | 'history'

export function RewardsHub({
  balance,
  delta,
  next,
  ledger,
  rules,
  pendingRuleIds,
  requests,
  lbRows,
  lbMyRanks,
  lbSettings,
  lbConfig,
}: {
  balance: number
  delta: number
  next: NextReward | null
  ledger: LedgerEntry[]
  rules: LoyaltyRule[]
  pendingRuleIds: string[]
  requests: RedemptionRequest[]
  lbRows: LeaderboardRow[]
  lbMyRanks: MyRank[]
  lbSettings: LeaderboardSettings
  lbConfig: LeaderboardConfigRow[]
}) {
  const reduced = useReducedMotion()
  const leaderboardVisible = lbSettings.enabled && lbConfig.some((c) => c.enabled)

  const tabs: { id: TabId; label: string }[] = [
    ...(leaderboardVisible ? [{ id: 'leaderboard' as const, label: '🏆 Classement' }] : []),
    { id: 'rewards', label: '🎁 Récompenses' },
    { id: 'history', label: '📜 Historique' },
  ]
  const [active, setActive] = useState<TabId>(tabs[0].id)

  return (
    <div className="space-y-4">
      <PointsHero balance={balance} delta={delta} next={next} />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className="relative text-xs font-semibold px-3.5 py-2 rounded-full whitespace-nowrap"
            style={{ color: t.id === active ? 'white' : 'var(--synapse-brown-700)' }}
          >
            {t.id === active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--synapse-green-500)' }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          initial={reduced ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {active === 'leaderboard' && (
            <LeaderboardPanel rows={lbRows} myRanks={lbMyRanks} settings={lbSettings} config={lbConfig} />
          )}
          {active === 'rewards' && (
            <RewardsPanel balance={balance} rules={rules} pendingRuleIds={pendingRuleIds} requests={requests} />
          )}
          {active === 'history' && <HistoryPanel ledger={ledger} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Write `page.tsx`**

```tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  getStudentLoyaltyBalance,
  getStudentLoyaltyLedger,
  getActiveLoyaltyRules,
  getStudentPendingRequestRuleIds,
  getStudentRedemptionRequests,
} from '@/data/student/loyalty'
import {
  getLeaderboard,
  getMyLeaderboardRank,
  getLeaderboardSettings,
  getLeaderboardConfig,
} from '@/data/student/leaderboard'
import { getNextReward, weeklyDelta } from '@/lib/rewards'
import { RewardsHub } from './RewardsHub'

export default async function StudentRewardsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const studentId = user!.id

  const [balance, ledger, rules, pendingRuleIds, requests, lbRows, lbMyRanks, lbSettings, lbConfig] =
    await Promise.all([
      getStudentLoyaltyBalance(studentId),
      getStudentLoyaltyLedger(studentId),
      getActiveLoyaltyRules(),
      getStudentPendingRequestRuleIds(studentId),
      getStudentRedemptionRequests(studentId),
      getLeaderboard(),
      getMyLeaderboardRank(),
      getLeaderboardSettings(),
      getLeaderboardConfig(),
    ])

  return (
    <RewardsHub
      balance={balance}
      delta={weeklyDelta(ledger)}
      next={getNextReward(balance, rules)}
      ledger={ledger}
      rules={rules}
      pendingRuleIds={pendingRuleIds}
      requests={requests as Parameters<typeof RewardsHub>[0]['requests']}
      lbRows={lbRows}
      lbMyRanks={lbMyRanks}
      lbSettings={lbSettings}
      lbConfig={lbConfig}
    />
  )
}
```

Note for implementer: if the `requests` cast is unnecessary (Supabase types already align), drop it. If Supabase returns `loyalty_rules` as an array type, map it: `requests.map((r) => ({ ...r, loyalty_rules: Array.isArray(r.loyalty_rules) ? r.loyalty_rules[0] ?? null : r.loyalty_rules }))` — mirror however the old loyalty page's cast worked (`req.loyalty_rules as { name: string } | null`).

- [ ] **Step 3: Rewrite loyalty page as redirect**

Replace entire content of `apps/web/src/app/student/loyalty/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function StudentLoyaltyPage() {
  redirect('/student/rewards')
}
```

- [ ] **Step 4: Update bottom nav**

In `apps/web/src/components/student/StudentBottomNav.tsx`:
- Import `Trophy` instead of `Star` from `@phosphor-icons/react`.
- Change tab entry to `{ href: '/student/rewards', label: 'Récompenses', Icon: Trophy }`.

- [ ] **Step 5: Typecheck + lint + tests**

```bash
cd /home/sah/Synapse/apps/web && pnpm typecheck && pnpm lint && pnpm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /home/sah/Synapse && git add apps/web/src/app/student/rewards apps/web/src/app/student/loyalty/page.tsx apps/web/src/components/student/StudentBottomNav.tsx && git commit -m "feat: add /student/rewards hub, redirect loyalty, update nav"
```

---

### Task 7: Dashboard teaser + remove `LeaderboardCard`

**Files:**
- Create: `apps/web/src/components/student/GamificationTeaser.tsx`
- Modify: `apps/web/src/app/student/dashboard/page.tsx`
- Delete: `apps/web/src/app/student/dashboard/LeaderboardCard.tsx`

**Interfaces:**
- Consumes: `MyRank`, `LeaderboardSettings`, `LeaderboardConfigRow` types; `getStudentLoyaltyBalance`.
- Produces: `GamificationTeaser({ balance, myRank, leaderboardVisible }: { balance: number; myRank: number | null; leaderboardVisible: boolean })` — server-renderable (no 'use client').

- [ ] **Step 1: Write `GamificationTeaser.tsx`**

```tsx
import Link from 'next/link'
import { Trophy, ArrowRight } from '@phosphor-icons/react/dist/ssr'

export function GamificationTeaser({
  balance,
  myRank,
  leaderboardVisible,
}: {
  balance: number
  myRank: number | null
  leaderboardVisible: boolean
}) {
  return (
    <Link
      href="/student/rewards"
      className="flex items-center gap-3 rounded-xl p-4 transition-transform active:scale-[0.99]"
      style={{ background: 'linear-gradient(140deg, #2b2419, #4a3b23)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,216,115,0.15)' }}
      >
        <Trophy size={20} weight="fill" style={{ color: '#ffd873' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: '#ffd873' }}>
          {balance.toLocaleString('fr-FR')} pts ✦
        </p>
        <p className="text-xs" style={{ color: '#bfae85' }}>
          {leaderboardVisible && myRank ? `#${myRank} au classement du mois` : 'Récompenses & classement'}
        </p>
      </div>
      <ArrowRight size={16} style={{ color: '#d9c896' }} />
    </Link>
  )
}
```

- [ ] **Step 2: Update dashboard page**

In `apps/web/src/app/student/dashboard/page.tsx`:
- Remove import of `LeaderboardCard`; add imports:

```tsx
import { GamificationTeaser } from '@/components/student/GamificationTeaser'
import { getStudentLoyaltyBalance } from '@/data/student/loyalty'
import { createSupabaseClient } from '@/supabase-clients/server'
```

- Replace the `getLeaderboard()` fetch with the loyalty balance; keep `getMyLeaderboardRank`, `getLeaderboardSettings`, `getLeaderboardConfig` (needed for teaser rank/visibility), drop `lbRows`. New parallel fetch block:

```tsx
const supabase = await createSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const [profile, activeSubscription, presence, importantNotifications, lbMyRanks, lbSettings, lbConfig, balance] =
  await Promise.all([
    getMyProfile(),
    getMyActiveSubscription(),
    getMyPresence(),
    getMyImportantNotifications(),
    getMyLeaderboardRank(),
    getLeaderboardSettings(),
    getLeaderboardConfig(),
    getStudentLoyaltyBalance(user!.id),
  ])
```

- Remove `getLeaderboard` from the `@/data/student/leaderboard` import (keep the other three).
- Replace `<LeaderboardCard rows={lbRows} myRanks={lbMyRanks} settings={lbSettings} config={lbConfig} />` with:

```tsx
{(() => {
  const enabledCats = lbConfig.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const leaderboardVisible = lbSettings.enabled && enabledCats.length > 0
  const primary = enabledCats[0]?.category
  const myRank = lbMyRanks.find((m) => m.category === primary)?.rank ?? null
  return <GamificationTeaser balance={balance} myRank={myRank} leaderboardVisible={leaderboardVisible} />
})()}
```

(Implementer may hoist these consts above the JSX instead of an IIFE — preferred; shown inline for locality.)

- [ ] **Step 3: Delete old card**

```bash
cd /home/sah/Synapse && git rm apps/web/src/app/student/dashboard/LeaderboardCard.tsx
```

- [ ] **Step 4: Typecheck + lint + tests**

```bash
cd /home/sah/Synapse/apps/web && pnpm typecheck && pnpm lint && pnpm test
```

Expected: all pass. Also `grep -rn "LeaderboardCard" apps/web/src` returns nothing.

- [ ] **Step 5: Commit**

```bash
cd /home/sah/Synapse && git add -A apps/web/src && git commit -m "feat: replace dashboard leaderboard card with rewards teaser"
```

---

### Task 8: End-to-end verification

**Files:** none created; manual/e2e verification.

- [ ] **Step 1: Run full checks**

```bash
cd /home/sah/Synapse/apps/web && pnpm typecheck && pnpm lint && pnpm test
```

Expected: all pass.

- [ ] **Step 2: Run dev server and verify flows**

```bash
cd /home/sah/Synapse && pnpm dev
```

As a student user verify:
1. `/student/rewards` renders: dark gold hero with count-up, weekly delta, next-reward progress bar.
2. Three tabs switch with pill + slide animations; leaderboard podium springs up; category chips work.
3. Rewards tab: rings, gold border on affordable rewards, `RequestButton` works (request lands in employee loyalty-requests flow).
4. History tab: ledger with staggered entrance.
5. `/student/loyalty` redirects to `/student/rewards`.
6. Bottom nav "Récompenses" tab (Trophy) highlights on the new route.
7. Dashboard shows dark teaser card (points + rank), no old leaderboard card.
8. Emulate `prefers-reduced-motion` in devtools: no count-up/shimmer/springs, values render final.

- [ ] **Step 3: Existing e2e suite (optional but recommended)**

```bash
cd /home/sah/Synapse/apps/web && pnpm test:e2e
```

Expected: no regressions (no specs referenced `/student/loyalty` at plan time; if any fail on nav assertions, update hrefs to `/student/rewards`).

- [ ] **Step 4: Final commit if fixups occurred**

```bash
cd /home/sah/Synapse && git add -A && git commit -m "fix: rewards hub verification fixups"
```
