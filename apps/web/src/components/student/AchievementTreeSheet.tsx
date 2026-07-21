'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Trophy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { Achievement, AchievementUnlockers } from '@/data/student/achievements'

const CATEGORY_META: Record<Achievement['category'], { label: string; emoji: string }> = {
  visits: { label: 'Visites', emoji: '🚪' },
  hours: { label: 'Heures', emoji: '📚' },
  streak: { label: 'Série', emoji: '🔥' },
  spend: { label: 'Dépenses', emoji: '💳' },
  purchase_count: { label: 'Achats', emoji: '🛍️' },
  manual: { label: 'Spécial', emoji: '🌟' },
}

function socialProof(u: { totalCount: number; sampleNames: string[] } | undefined): string | null {
  if (!u || u.totalCount === 0) return null
  const [first, ...rest] = u.sampleNames
  if (!first) return `${u.totalCount} personne${u.totalCount > 1 ? 's' : ''}`
  const others = u.totalCount - 1
  if (others <= 0) return `${first} l'a débloqué`
  return `${first} et ${others} autre${others > 1 ? 's' : ''}`
}

function TreeBranch({ achievements, unlockers }: { achievements: Achievement[]; unlockers: AchievementUnlockers }) {
  const reduced = useReducedMotion()

  return (
    <div className="relative pl-2">
      {achievements.map((a, i) => {
        const proof = socialProof(unlockers[a.id])
        const isLast = i === achievements.length - 1
        return (
          <div key={a.id} className="relative flex gap-3">
            {/* connecting line */}
            {!isLast && (
              <div
                className="absolute left-[23px] top-12 bottom-0 w-0.5"
                style={{ background: a.unlocked ? 'var(--synapse-green-600)' : 'var(--synapse-cream-300)' }}
              />
            )}

            <motion.div
              initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduced ? 0 : i * 0.06 }}
              className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{
                background: a.unlocked ? 'var(--synapse-green-600)' : 'var(--synapse-cream-300)',
                color: a.unlocked ? 'white' : 'var(--muted-foreground)',
                border: a.unlocked ? '2px solid var(--synapse-green-700)' : '2px solid var(--synapse-cream-300)',
              }}
            >
              {a.category === 'manual' && !a.unlocked ? '🔒' : a.emoji}
            </motion.div>

            <div className="flex-1 pb-8 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold">{a.title}</p>
                {a.unlocked ? (
                  <span
                    className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                    style={{ background: 'var(--synapse-green-100)', color: 'var(--synapse-green-700)' }}
                  >
                    ✓ +{a.points} pts
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                    +{a.points} pts
                  </span>
                )}
              </div>
              {a.description && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {a.description}
                </p>
              )}

              {!a.unlocked && a.category !== 'manual' && (
                <div className="mt-2 max-w-[200px]">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--synapse-cream-300)' }}>
                    <div
                      className="h-full transition-all duration-300"
                      style={{ background: 'var(--synapse-green-600)', width: `${Math.round(a.progress * 100)}%` }}
                    />
                  </div>
                  {a.threshold != null && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      {Math.round(a.progress * a.threshold)}/{a.threshold}
                    </p>
                  )}
                </div>
              )}

              {proof && (
                <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--synapse-brown-500)' }}>
                  🏅 {proof}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AchievementTreeSheet({
  achievements,
  unlockers,
}: {
  achievements: Achievement[]
  unlockers: AchievementUnlockers
}) {
  const [open, setOpen] = useState(false)

  const byCategory = new Map<Achievement['category'], Achievement[]>()
  for (const a of achievements) {
    const list = byCategory.get(a.category) ?? []
    list.push(a)
    byCategory.set(a.category, list)
  }
  const categories = (Object.keys(CATEGORY_META) as Achievement['category'][]).filter((c) => byCategory.has(c))
  const unlockedTotal = achievements.filter((a) => a.unlocked).length

  if (achievements.length === 0) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          style={{ borderColor: 'var(--synapse-cream-300)', background: 'var(--synapse-cream-100)' }}
        >
          <Trophy size={16} weight="fill" style={{ color: 'var(--accent-brand)' }} />
          <span className="text-sm font-semibold">
            Voir les succès ({unlockedTotal}/{achievements.length})
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[100dvh] w-full max-w-none flex flex-col p-0 gap-0">
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <SheetTitle asChild>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
              Parcours de succès
            </p>
          </SheetTitle>
          <SheetDescription asChild>
            <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}>
              {unlockedTotal}/{achievements.length} débloqués
            </p>
          </SheetDescription>
        </div>

        <Tabs defaultValue={categories[0]} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
            {categories.map((c) => (
              <TabsTrigger
                key={c}
                value={c}
                className="rounded-full text-xs data-[state=active]:bg-[var(--synapse-green-600)] data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((c) => (
            <TabsContent key={c} value={c} className="flex-1 overflow-y-auto px-5 py-5 mt-0">
              <TreeBranch achievements={byCategory.get(c) ?? []} unlockers={unlockers} />
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
