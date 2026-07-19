import { Hero } from './_components/Hero';
import { ChoiceCards } from './_components/ChoiceCards';
import { Features } from './_components/Features';
import { Stats } from './_components/Stats';
import { HowItWorks } from './_components/HowItWorks';
import { getLandingSeatmapMode, getPublicSeatRows } from '@/data/marketing/seatmap';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const mode = await getLandingSeatmapMode();
  const seatRows = mode === 'real' ? await getPublicSeatRows() : null;

  return (
    <>
      <Hero seatmapMode={mode} seatmapRows={seatRows} />
      <ChoiceCards />
      <Features />
      <Stats />
      <HowItWorks />
    </>
  );
}
