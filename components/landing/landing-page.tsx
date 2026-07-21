import { LandingNavbar } from './navbar';
import { LandingHero } from './hero';
import { LandingStory } from './story';
import { LandingManager } from './manager';
import { LandingPushScore } from './push-score';
import { LandingComparison } from './comparison';
import { LandingPricing } from './pricing';
import { LandingFaq } from './faq';
import { LandingFooter } from './footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <style>{`
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', system-ui, sans-serif; background: #09090b; }
        .grain {
          background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 3px 3px;
        }
        details[open] summary .chev { transform: rotate(180deg); }
      `}</style>
      <LandingNavbar />
      <LandingHero />
      <LandingStory />
      <LandingManager />
      <LandingPushScore />
      <LandingComparison />
      <LandingPricing />
      <LandingFaq />
      <LandingFooter />
    </div>
  );
}
