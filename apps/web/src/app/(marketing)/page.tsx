import { Hero } from './_components/Hero';
import { ChoiceCards } from './_components/ChoiceCards';
import { Features } from './_components/Features';
import { Stats } from './_components/Stats';
import { HowItWorks } from './_components/HowItWorks';
import { getLandingSeatmapMode, getPublicSeatSnapshot } from '@/data/marketing/seatmap';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const mode = await getLandingSeatmapMode();
  const snapshot = mode === 'real' ? await getPublicSeatSnapshot() : null;

  return (
    <>
      <Hero seatmapMode={mode} seatmapSnapshot={snapshot} />
      <ChoiceCards />
      <Features />
      <Stats />
      <HowItWorks />
    </>
  );
}
