# 005 — Animate admin reorder and empty-state transitions

- **Status**: DONE
- **Commit**: e3da42f
- **Severity**: MEDIUM
- **Category**: Missed opportunity (state teleport)
- **Estimated scope**: 3 files
- **Deviation**: `employees/page.tsx` is an async server component (searchParams-driven), so the plan's inline `motion.span`/`AnimatePresence` couldn't be used directly — extracted a `'use client'` `EmptyStateText.tsx` wrapper instead. Same crossfade behavior, different file layout.

## Problem

Three admin surfaces teleport instead of transitioning, per AUDIT.md §8: "State changes that teleport (content swaps, layout jumps) where a brief transition would prevent a jarring change."

**A. `src/app/admin/settings/navigation/NavOrderEditor.tsx:79-114`** — current, row markup inside the `.map()`:

```tsx
// current, lines 79-114 (relevant excerpt)
return (
  <div
    key={item.key}
    className="flex items-center gap-3 rounded-md border p-2"
    style={{ opacity: item.hidden ? 0.5 : 1 }}
  >
    <Icon size={18} />
    <span className="flex-1 text-sm">{item.label}</span>
    <button type="button" onClick={() => move(item.key, -1)} disabled={indexInGroup === 0} className="disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" aria-label={`Monter ${item.label}`}>
      <CaretUp size={16} />
    </button>
    <button type="button" onClick={() => move(item.key, 1)} disabled={indexInGroup === groupItems.length - 1} className="disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" aria-label={`Descendre ${item.label}`}>
      <CaretDown size={16} />
    </button>
    <button type="button" onClick={() => toggleHidden(item.key)} className="cursor-pointer" aria-label={item.hidden ? `Afficher ${item.label}` : `Masquer ${item.label}`}>
      {item.hidden ? <EyeSlash size={16} /> : <Eye size={16} />}
    </button>
  </div>
)
```

Clicking Up/Down calls `move()` (lines 34-45), which swaps two entries in the `items` array via `setItems`. React re-renders the rows in new order with no transition — the row jumps.

**B. `src/app/admin/employees/page.tsx:63,109`** — empty-state text swaps instantly when `showArchived` toggles:

```tsx
// current, ~line 63 (inside a <tr>/<td>)
{showArchived ? 'Aucun employé archivé' : 'Aucun employé'}
```

```tsx
// current, ~line 109
{showArchived ? 'Aucun compte kiosque archivé' : 'Aucun compte kiosque'}
```

**C. `src/app/admin/products/products-table.tsx:107-110`** — empty-state text swaps instantly on filter/search:

```tsx
// current, lines 107-110
{total === 0 ? (
  <div className="border rounded-md px-4 py-8 text-center text-muted-foreground">
    {products.length === 0 ? 'Aucun produit' : 'Aucun résultat'}
  </div>
) : (
```

## Target

**A. NavOrderEditor** — wrap the row in `motion.div` with the `layout` prop so it animates to its new position when the array reorders:

```tsx
// target — add import at top of file
import { motion } from 'motion/react'

// target, row markup
return (
  <motion.div
    key={item.key}
    layout
    transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
    className="flex items-center gap-3 rounded-md border p-2"
    style={{ opacity: item.hidden ? 0.5 : 1 }}
  >
    <Icon size={18} />
    <span className="flex-1 text-sm">{item.label}</span>
    <button type="button" onClick={() => move(item.key, -1)} disabled={indexInGroup === 0} className="disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" aria-label={`Monter ${item.label}`}>
      <CaretUp size={16} />
    </button>
    <button type="button" onClick={() => move(item.key, 1)} disabled={indexInGroup === groupItems.length - 1} className="disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" aria-label={`Descendre ${item.label}`}>
      <CaretDown size={16} />
    </button>
    <button type="button" onClick={() => toggleHidden(item.key)} className="cursor-pointer" aria-label={item.hidden ? `Afficher ${item.label}` : `Masquer ${item.label}`}>
      {item.hidden ? <EyeSlash size={16} /> : <Eye size={16} />}
    </button>
  </motion.div>
)
```

`layout` makes motion/react track this element's position via FLIP and animate to its new slot with a transform, not a layout property — no manual `transform`/`translateY` math needed. Spring per AUDIT.md §4's recommended Apple-style config: `{ type: "spring", duration: 0.35, bounce: 0.15 }` (subtle bounce, within the 0.1-0.3 range).

**B. Employees page** — wrap the swapped text in a keyed fade using `motion/react`'s `AnimatePresence` + `mode="wait"` is overkill for inline `<td>` text; use a lighter CSS-only crossfade via `key` + `@starting-style` is not practical inside a `<td>` either. Simplest correct fix: wrap in `motion.span` with `key={showArchived}` so motion/react remounts and fades on toggle:

```tsx
// target — add import at top of file (if not already present)
import { motion, AnimatePresence } from 'motion/react'

// target, ~line 63
<AnimatePresence mode="wait">
  <motion.span
    key={showArchived ? 'archived' : 'active'}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  >
    {showArchived ? 'Aucun employé archivé' : 'Aucun employé'}
  </motion.span>
</AnimatePresence>
```

Apply the identical pattern at line ~109 with `key={showArchived ? 'kiosk-archived' : 'kiosk-active'}` and the two kiosk strings.

**C. Products table empty state** — same crossfade pattern, keyed on which message is shown:

```tsx
// target, lines 107-110
{total === 0 ? (
  <AnimatePresence mode="wait">
    <motion.div
      key={products.length === 0 ? 'no-products' : 'no-results'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="border rounded-md px-4 py-8 text-center text-muted-foreground"
    >
      {products.length === 0 ? 'Aucun produit' : 'Aucun résultat'}
    </motion.div>
  </AnimatePresence>
) : (
```

Import `AnimatePresence` alongside `motion` at the top of `products-table.tsx` if not already imported (check existing imports first — this file may already import `motion` for the drag interactions; add `AnimatePresence` to that same import line rather than a new one).

## Repo conventions to follow

- `motion/react` (not `framer-motion`) is the package name used throughout this repo — e.g. `src/components/PageTransition.tsx:1` imports `from 'motion/react'`. Match that import path exactly.
- `layout` prop for reflow-on-reorder is already used in `src/components/notifications/NotificationItem.tsx:97` — same prop, same purpose (animate position changes via FLIP instead of manual transform math).
- `AnimatePresence` + keyed children for crossfades is already the pattern in `src/components/notifications/NotificationBell.tsx:136-147` — follow that structure (wrap the conditionally-keyed element, don't wrap the whole parent tree).
- Duration `0.15` for the empty-state crossfades sits inside AUDIT.md §2's budget for small UI feedback (100-200ms range for tooltips/small popovers — this is a comparable small-scale state swap).

## Steps

1. `src/app/admin/settings/navigation/NavOrderEditor.tsx` — add `import { motion } from 'motion/react'` near the top imports (after the existing `@phosphor-icons/react` import). Change the row's `<div key={item.key} ...>` (line ~80) to `<motion.div key={item.key} layout transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }} ...>` and its closing `</div>` (line ~113) to `</motion.div>`.
2. `src/app/admin/employees/page.tsx` — add/extend the `motion/react` import to include `motion, AnimatePresence`. Wrap the text at line 63 in the `AnimatePresence`/`motion.span` pattern shown in Target B. Repeat for line 109 with distinct `key` values.
3. `src/app/admin/products/products-table.tsx` — check the top of the file for an existing `motion/react` import (this file already has drag interactions, may already import `motion`); add `AnimatePresence` to that import if missing. Wrap the empty-state `<div>` at lines 107-110 in the `AnimatePresence`/`motion.div` pattern shown in Target C.

## Boundaries

- Do NOT add `layout` or motion wrappers to any other row/element in `NavOrderEditor.tsx`, `employees/page.tsx`, or `products-table.tsx` beyond what's specified — especially do not touch the actual data table `<tr>` rows in `products-table.tsx:129-150` (drag-and-drop reorder animation is a separate, unselected finding).
- Do NOT change `move()`, `toggleHidden()`, or any state logic — this is presentation-only.
- Do NOT add stagger to the NavOrderEditor list — it's a single-item reorder (one row moves), not a group entrance.
- If any cited line has drifted from what's quoted (diff from commit `e3da42f`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `cd apps/web && npx tsc --noEmit` — expect no errors (motion/react props are typed).
- **Feel check**:
  - `NavOrderEditor`: click an Up/Down arrow — the row should visibly slide to its new position (not snap), spring settling within ~350ms with subtle overshoot.
  - `employees/page.tsx`: toggle "archived" view when the list is empty — the empty-state text should crossfade (old text fades out, new text fades in), not flicker/replace instantly. Same for the kiosk accounts empty state.
  - `products-table.tsx`: filter products down to zero results, then clear the filter — the empty-state message should crossfade between "Aucun produit" and "Aucun résultat" as applicable, not snap.
  - In DevTools Animations panel at 10% playback, confirm the NavOrderEditor row's motion is a `transform` (not a `top`/`margin` change) — this is what `layout` produces.
  - Toggle `prefers-reduced-motion` (Rendering panel) and confirm the crossfades still show a brief opacity change (per plan 003's fix) while the NavOrderEditor spring's movement is suppressed but the row still ends in the correct position.
- **Done when**: all 3 files edited, `tsc --noEmit` passes, and each of the three interactions (reorder, employees empty-state toggle, products empty-state toggle) shows a smooth transition instead of an instant jump/swap in manual testing.
