# 004 — Fix scale(0) pop-in on celebration emoji

- **Status**: DONE
- **Commit**: e3da42f
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, 1 line

## Problem

```tsx
// src/components/student/CelebrationPopup.tsx:156-159 — current
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ delay: 0.05, type: 'spring', stiffness: 420, damping: 16 }}
  className="text-4xl"
  aria-hidden
>
  {meta.emoji}
</motion.div>
```

AUDIT.md §3: "**Never `scale(0)`** — nothing in the real world appears from nothing. Target: `scale(0.9–0.97)` + `opacity: 0`." The emoji currently pops from literal zero scale with no opacity fade, so it snaps into existence from nothing at the start of the spring.

## Target

```tsx
// src/components/student/CelebrationPopup.tsx:156-159 — target
<motion.div
  initial={{ scale: 0.9, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ delay: 0.05, type: 'spring', stiffness: 420, damping: 16 }}
  className="text-4xl"
  aria-hidden
>
  {meta.emoji}
</motion.div>
```

Only the `initial`/`animate` values change — `scale: 0` → `scale: 0.9` paired with a new `opacity: 0` → `opacity: 1`. The spring config (`stiffness: 420, damping: 16`, `delay: 0.05`) stays exactly as-is; this is a value-only fix, not a timing change.

## Repo conventions to follow

- The parent modal card in the same file (`CelebrationPopup.tsx:149-150`, the outer `motion.div`) already uses the correct pattern: `exit={{ opacity: 0, scale: 0.9 }}` pairs a non-zero scale with opacity. Mirror that same `0.9` scale floor and opacity pairing for the emoji, for visual consistency within the same component.

## Steps

1. `src/components/student/CelebrationPopup.tsx:157` — change `initial={{ scale: 0 }}` to `initial={{ scale: 0.9, opacity: 0 }}`.
2. `src/components/student/CelebrationPopup.tsx:158` — change `animate={{ scale: 1 }}` to `animate={{ scale: 1, opacity: 1 }}`.

## Boundaries

- Do NOT change the `transition` object (delay, spring stiffness/damping) — timing is not the defect here, the starting value is.
- Do NOT touch the outer modal card's motion props (lines ~149-151) — already correct, out of scope.
- Do NOT touch the confetti particles or points-counter animations elsewhere in this file.
- If line 156-159 has drifted from what's quoted above (diff from commit `e3da42f`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `cd apps/web && npx tsc --noEmit` — expect no errors (adding an `opacity` key to existing motion props is type-safe).
- **Feel check**: trigger a celebration popup (whatever student-facing flow surfaces `CelebrationPopup` — check for a dev/test trigger or storybook-style harness if one exists; otherwise reason from the component's props). In DevTools Animations panel, set playback to 10% and confirm:
  - The emoji fades in from ~90% scale + 0% opacity, not from nothing.
  - The spring's bounce/overshoot character is unchanged from before (same stiffness/damping feel).
- **Done when**: both `initial`/`animate` objects include the paired `scale`/`opacity` values above and the emoji no longer appears "from nothing" when played in slow motion.
