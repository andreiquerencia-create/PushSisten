'use client';

import { useState } from 'react';
import { useOnboardingContext } from './provider';
import { getStepsForPhase } from '@/lib/onboarding/steps';
import { X, Pause, Play, ChevronRight } from 'lucide-react';

export function OnboardingProgressBar() {
  const { state, isActive, currentStepConfig, totalSteps, progressPercent, pause, resume } = useOnboardingContext();
  const [minimized, setMinimized] = useState(false);

  if (!isActive || !state) return null;

  const steps = getStepsForPhase(state.phase);
  const currentIdx = state.currentStep;
  const completedCount = (state.completedSteps as string[]).length;

  // Minimized state — small floating pill
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed top-3 right-3 z-[9996] flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in slide-in-from-top-2"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
        <span>Configurando loja</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9996] animate-in slide-in-from-top-1 duration-300">
      {/* Background with glassmorphism */}
      <div className="bg-gradient-to-r from-primary/95 via-primary/90 to-accent/90 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="flex items-center h-11 px-4 gap-4">
          {/* Left: Step indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-primary-foreground/80 text-xs font-medium whitespace-nowrap">
              💡 {state.phase === 'activation' ? 'Configurando sua loja' : 'Aprendendo o financeiro'}
            </span>
          </div>

          {/* Center: Progress bar */}
          <div className="flex-1 flex items-center gap-3">
            {/* Step dots */}
            <div className="hidden sm:flex items-center gap-1">
              {steps.map((step, idx) => {
                const isCompleted = (state.completedSteps as string[]).includes(step.key);
                const isSkipped = (state.skippedSteps as string[]).includes(step.key);
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={step.key}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-white scale-100'
                        : isSkipped
                        ? 'bg-white/30 scale-75'
                        : isCurrent
                        ? 'bg-white scale-125 animate-pulse'
                        : 'bg-white/20 scale-75'
                    }`}
                  />
                );
              })}
            </div>

            {/* Progress bar visual */}
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(5, (completedCount / totalSteps) * 100)}%` }}
              />
            </div>

            {/* Step counter */}
            <span className="text-primary-foreground text-xs font-semibold whitespace-nowrap">
              {completedCount}/{totalSteps}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={pause}
              className="p-1.5 rounded-md hover:bg-white/10 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              title="Pausar configuração"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 rounded-md hover:bg-white/10 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              title="Minimizar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
