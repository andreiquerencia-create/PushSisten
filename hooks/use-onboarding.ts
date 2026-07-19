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
  const { data: session, status: sessionStatus } = useSession();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // INSTRUMENTATION
  console.log('[ONBOARDING-HOOK] Render. sessionStatus:', sessionStatus, 'session.user:', session?.user?.email || 'null', 'isLoading:', isLoading);

  // Carrega estado do backend ao montar
  useEffect(() => {
    console.log('[ONBOARDING-HOOK] useEffect triggered. sessionStatus:', sessionStatus, 'session?.user:', !!session?.user);

    if (sessionStatus === 'loading') {
      console.log('[ONBOARDING-HOOK] Session still loading, waiting...');
      return;
    }

    if (!session?.user) {
      console.log('[ONBOARDING-HOOK] No session user. Setting isLoading=false.');
      setIsLoading(false);
      return;
    }

    console.log('[ONBOARDING-HOOK] Fetching /api/onboarding...');
    const startTime = Date.now();

    fetch('/api/onboarding')
      .then(res => {
        console.log('[ONBOARDING-HOOK] /api/onboarding response:', res.status, 'in', Date.now() - startTime, 'ms');
        return res.json();
      })
      .then(data => {
        console.log('[ONBOARDING-HOOK] /api/onboarding data:', JSON.stringify(data));
        setProgress(data.progress || null);
      })
      .catch(err => {
        console.error('[ONBOARDING-HOOK] /api/onboarding ERROR:', err.message);
      })
      .finally(() => {
        console.log('[ONBOARDING-HOOK] Setting isLoading=false. Total time:', Date.now() - startTime, 'ms');
        setIsLoading(false);
      });
  }, [session?.user, sessionStatus]);

  const sendAction = useCallback(async (action: string, data?: any) => {
    console.log('[ONBOARDING-HOOK] sendAction:', action, data ? JSON.stringify(data) : '');
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    });
    console.log('[ONBOARDING-HOOK] sendAction response:', res.status);
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[ONBOARDING-HOOK] sendAction ERROR body:', errBody);
      throw new Error('Erro ao atualizar onboarding');
    }
    const result = await res.json();
    console.log('[ONBOARDING-HOOK] sendAction result:', JSON.stringify(result));
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
