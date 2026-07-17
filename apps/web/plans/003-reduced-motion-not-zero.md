# 003 — Reduced motion should be gentler, not zero

- **Status**: DONE
- **Commit**: e3da42f
- **Severity**: MEDIUM-HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file

## Problem

```css
/* src/styles/globals.css:231-237 — current */
/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

AUDIT.md §6: "Reduced motion means fewer and gentler animations, **not zero** — keep transitions that aid comprehension, remove position changes." This blanket override collapses every transition and animation on every element to 0.01ms, including opacity/color feedback that helps users understand what just happened (button press states, focus changes, toast fade-ins). It's an indiscriminate kill-switch, not the "fewer and gentler" treatment the rule calls for.

It also only touches CSS `transition`/`animation` properties — it has no effect on motion/react's JS-driven, inline-style animations (`PointsHero.tsx`, `LeaderboardPanel.tsx`, `CelebrationPopup.tsx`, etc.), which instead each implement their own `useReducedMotion()` branches. So today the app has two disconnected reduced-motion systems: a too-aggressive CSS blanket rule, and scattered JS-level opt-ins. This plan only fixes the CSS side (the JS side already has the correct pattern — see Repo conventions below).

## Target

```css
/* src/styles/globals.css:231-237 — target */
/* Reduced motion: drop movement, keep opacity/color feedback */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-property: opacity, color, background-color, border-color, box-shadow !important;
  }
}
```

Rationale: `animation-duration: 0.01ms` still collapses all `@keyframes`-driven animations (confetti, marquee, skeleton shimmer, accordion open/close via keyframes) to instant — that's correct, those are all movement/decorative. Forcing `transition-property` to an opacity/color allowlist means any element's `transition: transform 200ms, opacity 200ms` still shows its opacity fade but drops the transform movement, without needing to touch every component's transition declaration individually. This is a blunt but effective global override — simpler and more robust than trying to selectively target only "movement" transitions per-element.

## Repo conventions to follow

- The JS side already does this correctly — follow this pattern as the model for any future motion/react component: `src/components/student/CelebrationPopup.tsx` and `src/app/student/rewards/PointsHero.tsx`/`LeaderboardPanel.tsx` call `useReducedMotion()` from `motion/react` and branch `initial`/`animate` values (e.g. `PointsHero.tsx:73`: `initial={{ width: reduced ? '${next.progressPct}%' : 0 }}`) to skip movement while still rendering the final state. This CSS fix brings the CSS-only components (Radix-driven `animate-in`/`animate-out` utilities, plain `transition-*` classes) in line with that same "keep the end state legible, drop the travel" principle.
- Do not introduce a new `--reduced-motion-*` token; this is a single global media query block, consistent with its current placement in `globals.css`.

## Steps

1. Open `src/styles/globals.css`, locate the `@media (prefers-reduced-motion: reduce)` block at lines 231-237.
2. Replace its contents exactly as shown in Target above — comment updated, `transition-duration: 0.01ms !important` removed, replaced with the `transition-property` allowlist line, `animation-duration` kept, `animation-iteration-count: 1` and `scroll-behavior: auto` added.

## Boundaries

- Do NOT touch any component file — this is a single CSS block edit.
- Do NOT add `useReducedMotion()` calls to new components in this plan; that's covered by finding-specific work if/when those components are touched.
- Do NOT remove or weaken the `animation-duration: 0.01ms` line — keyframe-driven decorative motion (confetti, marquee, shimmer) should still collapse per the rule's "remove position changes" guidance.
- If the current CSS at lines 231-237 doesn't match what's quoted in Problem (diff from commit `e3da42f`), STOP and report instead of guessing where to apply the fix.

## Verification

- **Mechanical**: `cd apps/web && npm run build` (or the project's configured CSS/Tailwind build step) — confirm no CSS syntax errors, no new lint failures.
- **Feel check**: in Chrome DevTools, open Rendering panel → "Emulate CSS media feature prefers-reduced-motion: reduce". Then:
  - Hover/press a `Button` — background-color and `active:scale` — confirm the scale movement is now instant/suppressed but any color transition still animates (briefly, not 0.01ms).
  - Open a `Dialog`/`Sheet` — confirm it still fades in (opacity) but the slide/zoom movement is instant.
  - Trigger a toast — confirm it appears without slide-in motion but doesn't harshly flash.
  - Confirm the `CelebrationPopup` confetti and `accordion-down`/`accordion-up` keyframe animations remain fully suppressed (unchanged from before this fix — those go through `animation-duration`, not the new `transition-property` rule).
  - Turn the emulation off and confirm normal (non-reduced) behavior is completely unaffected — every transition/animation plays at its original duration and easing.
- **Done when**: reduced-motion mode still shows opacity/color feedback on interactive elements (not a hard cut to nothing), movement-based transitions are suppressed, keyframe animations remain suppressed, and normal mode is unchanged.
