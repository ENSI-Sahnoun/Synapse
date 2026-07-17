# 002 — Replace layout-property motion/react animations with transform/opacity

- **Status**: DONE
- **Commit**: e3da42f
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 3 files

## Problem

AUDIT.md §5: "**Animate `transform` and `opacity` only.** `width`/`height`/`margin`/`padding`/`top`/`left` trigger layout + paint + composite." Three motion/react components animate raw layout properties instead of transform-equivalents.

```tsx
// src/app/student/rewards/PointsHero.tsx:49-51 — current (shimmer sweep)
initial={{ left: '-40%' }}
animate={{ left: '120%' }}
transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
```

```tsx
// src/app/student/rewards/PointsHero.tsx:73-79 — current (progress bar fill)
<motion.div
  className="h-full rounded-full"
  style={{ background: GOLD }}
  initial={{ width: reduced ? `${next.progressPct}%` : 0 }}
  animate={{ width: `${next.progressPct}%` }}
  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
/>
```

```tsx
// src/app/student/rewards/LeaderboardPanel.tsx:103-108 — current (podium bar grow)
<motion.div
  className="w-full rounded-t-lg flex items-start justify-center pt-1"
  style={{ background: 'var(--synapse-cream-300)' }}
  initial={reduced ? { height: PODIUM_HEIGHTS[i] } : { height: 0 }}
  animate={{ height: PODIUM_HEIGHTS[i] }}
  transition={{ type: 'spring', stiffness: 160, damping: 20, delay: reduced ? 0 : 0.1 * i }}
>
```

```tsx
// src/components/notifications/NotificationItem.tsx:96-101 — current (list item exit)
<motion.div
  layout
  initial={{ opacity: 0, y: 8, scale: 0.98 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.95 }}
  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
  className="relative overflow-hidden rounded-xl"
>
```

## Target

```tsx
// PointsHero.tsx:49-51 — target: translateX instead of left
initial={{ transform: 'translateX(-140%)' }}
animate={{ transform: 'translateX(140%)' }}
transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
// parent wrapper (line ~45) must keep `overflow-hidden` and the shimmer div's
// own width (w-1/3 = 33.33%) unchanged; translateX percentages are relative
// to the ELEMENT's own width, so -140%/140% moves it from just off the
// left edge to just off the right edge of a 33%-wide element inside its
// container — matches the visual range of the old left: -40% -> 120%
// (adjust to -300%/300% if the container is much wider than the element;
// verify visually per the feel-check step below, this is an approximation
// the executor must eyeball against the original sweep distance)
```

```tsx
// PointsHero.tsx:73-79 — target: scaleX instead of width
<motion.div
  className="h-full rounded-full origin-left"
  style={{ background: GOLD }}
  initial={{ scaleX: reduced ? next.progressPct / 100 : 0 }}
  animate={{ scaleX: next.progressPct / 100 }}
  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
/>
// Parent div (line ~72, the track) must render at full width with
// `overflow-hidden` already present (it is, per current code) so the
// scaled child fills the track visually the same way `width: %` did.
// Add `origin-left` so the scale grows from the left edge, not center —
// this is the transform-equivalent of a width fill.
```

```tsx
// LeaderboardPanel.tsx:103-108 — target: scaleY instead of height
<motion.div
  className="w-full rounded-t-lg flex items-start justify-center pt-1 origin-bottom"
  style={{ background: 'var(--synapse-cream-300)', height: PODIUM_HEIGHTS[i] }}
  initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
  animate={{ scaleY: 1 }}
  transition={{ type: 'spring', stiffness: 160, damping: 20, delay: reduced ? 0 : 0.1 * i }}
>
// `height: PODIUM_HEIGHTS[i]` moves to a static inline style (the element's
// real, final height, always rendered at full size); `scaleY` animates from
// 0 to 1 with `origin-bottom` so it grows upward from the podium base,
// visually equivalent to the old height:0 -> height:N animation.
```

```tsx
// NotificationItem.tsx:96-101 — target: drop height/marginTop from exit
<motion.div
  layout
  initial={{ opacity: 0, y: 8, scale: 0.98 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
  className="relative overflow-hidden rounded-xl"
>
// The `layout` prop (already present, line 97) makes motion/react track
// this element's box via FLIP and animate the resulting height/margin
// changes on SIBLINGS automatically when this item is removed from the
// list — explicit height:0/marginTop:0 in `exit` is redundant with what
// `layout` already provides for surrounding items, and was directly
// setting layout properties on this element too. Removing them lets
// `layout` handle the reflow via transform, and this element itself only
// fades/scales out.
```

## Repo conventions to follow

- `reduced` (from `useReducedMotion()`, motion/react) is already threaded through `PointsHero.tsx` and `LeaderboardPanel.tsx` as a prop/hook result — preserve every existing `reduced ? … : …` branch exactly, only change the property being animated inside each branch.
- `motion.div` with a `layout` prop is already the pattern for reflow-on-remove in `NotificationItem.tsx:97` — do not remove the `layout` prop, only the `height`/`marginTop` keys inside `exit`.
- No shared spring/easing tokens exist; keep each element's existing `transition` object (duration, ease, spring config) untouched — only the animated property names and their initial/animate/exit values change.

## Steps

1. `src/app/student/rewards/PointsHero.tsx:49-51` — replace `left` keys with `transform: 'translateX(...)'` string values as shown in Target. Confirm the parent shimmer wrapper (~line 44-47) still has `overflow-hidden` so the translated element doesn't visually escape the card.
2. `src/app/student/rewards/PointsHero.tsx:73-79` — replace `width` keys with `scaleX` (0-1 range, `next.progressPct / 100`), add `origin-left` to the motion.div's className.
3. `src/app/student/rewards/LeaderboardPanel.tsx:103-108` — move `PODIUM_HEIGHTS[i]` from the `initial`/`animate` height keys into a static `style={{ height: PODIUM_HEIGHTS[i] }}`, replace `height: 0`/`height: PODIUM_HEIGHTS[i]` in initial/animate with `scaleY: 0`/`scaleY: 1`, add `origin-bottom` to className.
4. `src/components/notifications/NotificationItem.tsx:100` — remove `height: 0, marginTop: 0` from the `exit` object, leaving `exit={{ opacity: 0, scale: 0.95 }}`.

## Boundaries

- Do NOT touch `HistoryPanel.tsx`, `RewardsHub.tsx`, `RewardsPanel.tsx`, `StudentSplash.tsx`, `CelebrationPopup.tsx`, `PageTransition.tsx`, `AirdropPopup.tsx`, `DiversSeatPrompt.tsx`, `ImportantAnnouncements.tsx` — their `x`/`y`/`scale` shorthand usage is a separate, lower-severity finding (main-thread but still composited; not a layout-property violation) and out of scope here.
- Do NOT change spring configs, durations, delays, or easing curves — only the animated property and its corresponding CSS transform-origin/static-height setup.
- Do NOT remove the `reduced`/`useReducedMotion()` branches.
- If the cited line numbers or surrounding JSX have drifted from what's quoted (diff from commit `e3da42f`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `cd apps/web && npx tsc --noEmit` — expect no type errors (motion/react accepts `scaleX`/`scaleY`/string `transform` in animate props).
- **Feel check**:
  - `PointsHero`: view the rewards page with an active progress goal — shimmer sweep should visually cover the same left-to-right range as before (open DevTools, set Animations panel playback to 10%, confirm the shimmer band starts just off-screen left and ends just off-screen right, same as pre-change). Progress bar should fill left-to-right identically, no stretch/skew artifact from `scaleX` (the `origin-left` is what prevents center-out scaling).
  - `LeaderboardPanel`: view the podium — bars should grow upward from the base (not squash from center), same stagger timing as before (`0.1 * i` delay).
  - `NotificationItem`: dismiss/clear a notification in a list of 3+ — sibling items should still smoothly slide up into the vacated space (via the `layout` prop), and the removed item should fade/scale out without a visible height snap.
  - Toggle `prefers-reduced-motion` (DevTools Rendering panel) and confirm `PointsHero`/`LeaderboardPanel` still respect their `reduced` branches (bars render at final size immediately, no animation).
- **Done when**: all 4 edits applied, `tsc --noEmit` passes, and each of the 3 components visually matches its pre-change behavior when played at 10% speed in DevTools (same start/end state, same perceived motion path).
