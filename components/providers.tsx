'use client';

import { SessionProvider } from 'next-auth/react';
import { OnboardingProvider } from '@/components/onboarding/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingProvider>
        {children}
      </OnboardingProvider>
    </SessionProvider>
  );
}
