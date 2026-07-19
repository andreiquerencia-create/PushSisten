'use client';

import { useOnboardingContext } from './provider';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronRight, SkipForward, Sparkles } from 'lucide-react';

export function OnboardingStepCard() {
  const { state, isActive, currentStepConfig, advance, skip, totalSteps } = useOnboardingContext();
  const router = useRouter();
  const pathname = usePathname();

  if (!isActive || !state || !currentStepConfig) return null;

  // Don't show step card for welcome (setup screen) or celebration
  if (currentStepConfig.key === 'welcome' || currentStepConfig.key === 'celebration') return null;

  const completedCount = (state.completedSteps as string[]).length;
  const isOnCorrectRoute = !!(currentStepConfig.route && pathname.startsWith(currentStepConfig.route));

  const handleGoToStep = () => {
    if (currentStepConfig.route) {
      router.push(currentStepConfig.route);
    }
  };

  const handleAdvanceStep = () => {
    advance();
  };

  const handleSkip = () => {
    skip();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9997] w-80 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-2xl shadow-black/10">
        {/* Header with sparkle */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-tight">
              {currentStepConfig.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {currentStepConfig.description}
            </p>
          </div>
        </div>

        {/* Mini progress */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {completedCount}/{totalSteps}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {currentStepConfig.skippable && (
            <button
              onClick={handleSkip}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted"
            >
              <SkipForward className="w-3 h-3" />
              Pular
            </button>
          )}
          {isOnCorrectRoute ? (
            <Button
              size="sm"
              onClick={handleAdvanceStep}
              className="ml-auto text-xs h-8 px-4 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              Concluído, próxima
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleGoToStep}
              className="ml-auto text-xs h-8 px-4 gap-1.5 rounded-lg"
            >
              Ir para etapa
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Duration hint */}
        <div className="mt-3 pt-2.5 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            ⏱ Estimativa: {currentStepConfig.duration}
          </p>
        </div>
      </div>
    </div>
  );
}
