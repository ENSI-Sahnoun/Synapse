import { Children, type ReactNode } from 'react'

// The room list is server-rendered, so the cards otherwise pop in all at once the
// moment the animated skeleton is replaced. The `card-rise` keyframe declares only
// its `from` state, so the server-rendered HTML carries the cards at their real
// (visible) style and the stagger is purely additive — there is no hydration gap
// where the rooms page looks empty. CSS-driven, so it needs no hooks and reduced
// motion is handled globally (which also zeroes the delay). Delay is capped so a
// long room list never leaves the last card waiting seconds.
export function RoomCardsStagger({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.map(children, (child, i) => (
        <div
          style={{
            animation: 'card-rise 250ms var(--ease-out) backwards',
            animationDelay: `${Math.min(i, 8) * 0.07}s`,
          }}
        >
          {child}
        </div>
      ))}
    </>
  )
}
