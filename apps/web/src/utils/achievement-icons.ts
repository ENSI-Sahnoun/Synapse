import {
  Trophy, Medal, Star, Crown, Fire, Flame, Mountains, BookOpen, Book,
  PersonSimpleRun, Door, DoorOpen, Buildings, CreditCard, Coffee, Cookie,
  Hamburger, Pizza, Diamond, ShoppingBag, ShoppingCart, Target, Lightning,
  RocketLaunch, Heart, ThumbsUp, Sparkle,
  type Icon,
} from '@phosphor-icons/react'

// Achievement icon field stores one of these names (legacy rows may still
// hold a raw emoji glyph from before the icon picker — resolveAchievementIcon
// falls back to Trophy for anything unrecognized).
export const ACHIEVEMENT_ICONS = {
  Trophy, Medal, Star, Crown, Fire, Flame, Mountains, BookOpen, Book,
  PersonSimpleRun, Door, DoorOpen, Buildings, CreditCard, Coffee, Cookie,
  Hamburger, Pizza, Diamond, ShoppingBag, ShoppingCart, Target, Lightning,
  RocketLaunch, Heart, ThumbsUp, Sparkle,
} satisfies Record<string, Icon>

export type AchievementIconName = keyof typeof ACHIEVEMENT_ICONS

export const ACHIEVEMENT_ICON_NAMES = Object.keys(ACHIEVEMENT_ICONS) as AchievementIconName[]

// Seeded achievement rows (20260727000000_achievements.sql) store a raw emoji
// glyph in `emoji`, not an icon name — map the glyphs actually in use so each
// category/tier gets a distinct icon instead of every row falling back to Trophy.
const EMOJI_TO_ICON: Record<string, Icon> = {
  '🚪': Door, '🏛️': Buildings,
  '📚': BookOpen, '📖': Book, '🏃': PersonSimpleRun,
  '🔥': Fire, '🌋': Flame,
  '🥐': Cookie, '🍔': Hamburger, '💳': CreditCard, '💎': Diamond,
  '🛍️': ShoppingBag, '🛒': ShoppingCart, '👑': Crown,
  '🌟': Sparkle, '🏆': Trophy, '🥇': Medal, '🥈': Medal, '🥉': Medal,
}

export function resolveAchievementIcon(name: string): Icon {
  return ACHIEVEMENT_ICONS[name as AchievementIconName] ?? EMOJI_TO_ICON[name] ?? Trophy
}
