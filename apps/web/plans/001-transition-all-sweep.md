# 001 — Replace `transition-all` with targeted transitions

- **Status**: DONE
- **Commit**: e3da42f
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 6 files, one-line class change each

## Problem

`transition-all` (Tailwind) compiles to `transition-property: all`, which animates every animatable property on the element — including layout properties (`width`, `height`, `padding`, `border-width`) that trigger layout + paint + composite, not just GPU-cheap `transform`/`opacity`/`background-color`. AUDIT.md §5: "**`transition: all`** animates unintended properties off-GPU — always a finding."

Current code, each file:

```tsx
// src/components/ui/button.tsx:8 — current (base class string, cva root)
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive motion-reduce:active:scale-100"
```

```tsx
// src/components/ui/accordion.tsx:31 — current
"flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180"
```

```tsx
// src/components/ui/accordion.tsx:49 — current
"overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
```

```tsx
// src/components/ui/progress.tsx:21 — current
"h-full w-full flex-1 bg-primary transition-all"
```

```tsx
// src/components/ui/mode-toggle.tsx:16-17 — current
<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
```

```tsx
// src/components/ui/input-otp.tsx:44 — current
"relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md"
```

```tsx
// src/components/ui/tabs.tsx:32 — current
"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
```

## Target

Replace `transition-all` with the specific properties each element actually animates. Tailwind arbitrary-property syntax: `transition-[property1,property2]`.

| File | Replace `transition-all` with | Why these properties |
|---|---|---|
| `button.tsx:8` | `transition-[transform,background-color,opacity,box-shadow]` | hover bg change, active scale, disabled opacity, focus ring shadow |
| `accordion.tsx:31` | `transition-transform` (the class already only needs to cover the `[&[data-state=open]>svg]:rotate-180` chevron rotation on the trigger's own hover/underline — text-decoration isn't transitionable in a meaningful way here, so drop to `transition-transform`) | only the child svg rotates; `hover:underline` doesn't need a transition |
| `accordion.tsx:49` | `transition-[height]` (keep — height IS what this element animates via the keyframes; `transition-all` here is redundant with the keyframe animation, not wrong-property, but still flags per the literal rule — narrow it to be explicit and stop it from also transitioning unrelated inherited properties) | scopes the transition declaration to what the keyframes actually touch |
| `progress.tsx:21` | `transition-transform` (the indicator is already driven by inline `style={{ transform: ... }}` — see line 22 — so `transition-all` here is animating `transform`, but declaring `all` is still wrong per the rule; narrow it) | the only thing that changes is the inline `transform` style |
| `mode-toggle.tsx:16` | `transition-[transform,opacity]` | rotate + scale (both transforms) between light/dark icon states |
| `mode-toggle.tsx:17` | `transition-[transform,opacity]` | same as above |
| `input-otp.tsx:44` | `transition-[border-color,box-shadow]` | only `ring-2 ring-ring` (box-shadow) and border toggle on `isActive` |
| `tabs.tsx:32` | `transition-[background-color,color,box-shadow]` | `data-[state=active]:bg-background`, text color, `shadow-sm` |

## Repo conventions to follow

- No shared `--duration-*`/`--ease-*` tokens exist yet — this plan does not introduce any; it only narrows the `transition-property` list, keeping each element's existing (implicit, Tailwind-default) duration/timing-function untouched.
- Tailwind arbitrary-property transition syntax already used elsewhere in this repo for scoped transitions, e.g. `src/components/ui/sidebar.tsx:98`: `transition-[width] duration-200 ease-linear` — follow that bracket syntax exactly (comma-separated, no spaces inside brackets).

## Steps

1. `src/components/ui/button.tsx:8` — replace `transition-all` with `transition-[transform,background-color,opacity,box-shadow]` in the cva base string.
2. `src/components/ui/accordion.tsx:31` — replace `transition-all` with `transition-transform` in `AccordionTrigger`'s className.
3. `src/components/ui/accordion.tsx:49` — replace `transition-all` with `transition-[height]` in `AccordionContent`'s className.
4. `src/components/ui/progress.tsx:21` — replace `transition-all` with `transition-transform` in the `ProgressPrimitive.Indicator` className.
5. `src/components/ui/mode-toggle.tsx:16` — replace `transition-all` with `transition-[transform,opacity]` on the `Sun` icon.
6. `src/components/ui/mode-toggle.tsx:17` — replace `transition-all` with `transition-[transform,opacity]` on the `Moon` icon.
7. `src/components/ui/input-otp.tsx:44` — replace `transition-all` with `transition-[border-color,box-shadow]`.
8. `src/components/ui/tabs.tsx:32` — replace `transition-all` with `transition-[background-color,color,box-shadow]`.

## Boundaries

- Do NOT touch `src/components/ui/sidebar.tsx` — its `transition-[width]` and `transition-[left,right,width]` are a separate, already-scoped finding (layout-property animation, not `transition-all`) and out of scope for this plan.
- Do NOT change any duration, easing, or add new CSS custom properties.
- Do NOT change component markup or props — className edits only.
- If any cited line's surrounding class string has drifted from what's quoted above (diff from commit `e3da42f`), STOP and report instead of guessing which properties to keep.

## Verification

- **Mechanical**: `cd apps/web && npx tsc --noEmit` (no type errors — these are string-literal class changes only) and `npx next lint` if configured. Expect no new errors.
- **Feel check**: run the dev server, open each affected component:
  - Toggle a `Button` (any variant) — press feedback (`active:scale-[0.97]`) still fires, hover background still transitions smoothly, no visual regression.
  - Open/close an `Accordion` — content still expands/collapses smoothly via the existing `animate-accordion-down/up` keyframes; chevron still rotates 180° smoothly on toggle.
  - Watch a `Progress` bar fill — indicator still slides via the inline `transform: translateX(...)`.
  - Toggle theme via `ModeToggle` — sun/moon icons still cross-fade/rotate smoothly, no snap.
  - Type in an OTP input — active slot still gets its ring transition, no snap.
  - Switch `Tabs` — active tab background/shadow still transitions, no snap.
  - In DevTools Elements panel, confirm the computed `transition-property` for each element now lists only the specific properties above, not `all`.
- **Done when**: all 8 edits applied, `tsc --noEmit` passes, and manual toggle of each of the 6 components shows no visual regression (same easing/duration feel as before, just scoped to fewer properties).
