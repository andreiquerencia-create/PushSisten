'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useOnboarding, OnboardingProgress, OnboardingStep } from '@/hooks/use-onboarding';

interface OnboardingContextType {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  isOnboarding: boolean;
  currentStep: OnboardingStep | null;
  start: () => Promise<void>;
  updateProfile: (data: { storeName: string; storeType: string; currentControl: string }) => Promise<void>;
  markProductCreated: () => Promise<void>;
  markCustomerCreated: () => Promise<void>;
  markSaleCompleted: () => Promise<void>;
  markDashboardViewed: () => Promise<void>;
  complete: () => Promise<void>;
  abandon: () => Promise<void>;
  resume: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const onboarding = useOnboarding();
  return (
    <OnboardingContext.Provider value={onboarding}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingContext deve ser usado dentro de OnboardingProvider');
  }
  return ctx;
}
