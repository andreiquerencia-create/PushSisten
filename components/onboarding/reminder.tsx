'use client';

import { useState } from 'react';
import { useOnboardingContext } from './provider';
import { Button } from '@/components/ui/button';
import { X, Play } from 'lucide-react';

export function OnboardingReminder() {
  const { state, resume } = useOnboardingContext();
  const [dismissed, setDismissed] = useState(false);

  // Only show if paused
  if (!state || state.status !== 'paused' || dismissed) return null;

  const completedCount = (state.completedSteps as string[]).length;
  const totalSteps = state.phase === 'activation' ? 8 : 7;

  return (
    <div className="fixed bottom-6 right-6 z-[9995] w-80 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Play className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Continue configurando sua loja
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Você completou {completedCount} de {totalSteps} etapas.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="text-xs h-7"
          >
            Depois
          </Button>
          <Button
            size="sm"
            onClick={resume}
            className="ml-auto text-xs h-7 gap-1"
          >
            <Play className="w-3 h-3" />
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
