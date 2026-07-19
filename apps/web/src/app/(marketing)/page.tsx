import { Hero } from './_components/Hero';
import { ChoiceCards } from './_components/ChoiceCards';
import { Features } from './_components/Features';
import { Stats } from './_components/Stats';
import { HowItWorks } from './_components/HowItWorks';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ChoiceCards />
      <Features />
      <Stats />
      <HowItWorks />
    </>
  );
}
