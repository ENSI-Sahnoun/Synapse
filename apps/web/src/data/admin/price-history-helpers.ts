export type PriceChangeEntry = {
  id: string
  oldPrice: number | null
  newPrice: number | null
  actorId: string
  createdAt: string
}

export function extractPriceChange(
  details: unknown,
): { oldPrice: number | null; newPrice: number | null } | null {
  if (!details || typeof details !== 'object') return null
  const d = details as { old?: { price_dt?: unknown }; new?: { price_dt?: unknown } }
  const oldPrice = typeof d.old?.price_dt === 'number' ? d.old.price_dt : null
  const newPrice = typeof d.new?.price_dt === 'number' ? d.new.price_dt : null
  if (oldPrice === null && newPrice === null) return null
  return { oldPrice, newPrice }
}
