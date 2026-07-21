'use client';

import { LandingNavbar } from './navbar';
import { LandingHero } from './hero';
import { StorySection } from './story-section';
import { TransformSection } from './transform-section';
import { FeaturesSection } from './features-section';
import { HowItWorksSection } from './how-it-works';
import { FaqSection } from './faq-section';
import { CtaSection } from './cta-section';
import { LandingFooter } from './footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <LandingNavbar />
      <LandingHero />
      <StorySection />
      <TransformSection />
      <FeaturesSection />
      <HowItWorksSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
