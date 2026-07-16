'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export type OnboardingStep =
  | 'welcome'
  | 'profile'
  | 'product'
  | 'customer'
  | 'sale'
  | 'dashboard'
  | 'next_steps'
  | 'completed';

export interface OnboardingProgress {
  id: string;
  userId: string;
  currentStep: OnboardingStep;
  completed: boolean;
  abandoned: boolean;
  abandonedAt: string | null;
  startedAt: string;
  completedAt: string | null;
  timeSpent: number;
  lastAccessAt: string;
  version: string;
  storeName: string | null;
  storeType: string | null;
  currentControl: string | null;
  profileCompleted: boolean;
  productCreated: boolean;
  customerCreated: boolean;
  saleCompleted: boolean;
  dashboardViewed: boolean;
}

interface UseOnboardingReturn {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  isOnboarding: boolean; // true se onboarding está ativo (não completo, não abandonado)
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

export function useOnboarding(): UseOnboardingReturn {
  const { data: session } = useSession();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carrega estado do backend ao montar
  useEffect(() => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    fetch('/api/onboarding')
      .then(res => res.json())
      .then(data => {
        setProgress(data.progress || null);
      })
      .catch(err => {
        console.error('Erro ao carregar onboarding:', err);
      })
      .finally(() => setIsLoading(false));
  }, [session?.user]);

  const sendAction = useCallback(async (action: string, data?: any) => {
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    });
    if (!res.ok) throw new Error('Erro ao atualizar onboarding');
    const result = await res.json();
    setProgress(result.progress);
  }, []);

  const isOnboarding = !!(progress && !progress.completed && !progress.abandoned);
  const currentStep = progress?.currentStep as OnboardingStep | null ?? null;

  return {
    progress,
    isLoading,
    isOnboarding,
    currentStep,
    start: () => sendAction('start'),
    updateProfile: (data) => sendAction('update_profile', data),
    markProductCreated: () => sendAction('product_created'),
    markCustomerCreated: () => sendAction('customer_created'),
    markSaleCompleted: () => sendAction('sale_completed'),
    markDashboardViewed: () => sendAction('dashboard_viewed'),
    complete: () => sendAction('complete'),
    abandon: () => sendAction('abandon'),
    resume: () => sendAction('resume'),
  };
}
