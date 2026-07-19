'use server'

import { getPublicSeatSnapshot } from '@/data/marketing/seatmap'

// Called directly from the landing page's client component to poll fresh
// occupancy every ~20s. No input, no auth — only ever returns aggregate counts.
export async function fetchPublicSeatSnapshot() {
  return getPublicSeatSnapshot()
}
