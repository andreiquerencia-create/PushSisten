'use client';

import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, GraduationCap, CheckCircle2 } from 'lucide-react';

interface AcademyPanelProps {
  moduleTitle: string;
  moduleIcon: string;
  submoduleTitle: string;
  instruction: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}

export function AcademyPanel({
  moduleTitle,
  moduleIcon,
  submoduleTitle,
  instruction,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onExit,
}: AcademyPanelProps) {
  const progressPercent = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0;
  const isLastStep = currentStep >= totalSteps - 1;
  const isFirstStep = currentStep === 0;

  // Detectar se é um step de celebração
  const isCelebration = instruction.startsWith('✅') || instruction.startsWith('🎉');

  return (
    <div className="fixed top-0 right-0 bottom-0 w-80 z-[100] flex flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">Push Academy</span>
        </div>
        <button
          onClick={onExit}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Sair do treinamento"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Module info */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{moduleIcon}</span>
          <h3 className="text-sm font-semibold text-foreground">{moduleTitle}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">{submoduleTitle}</p>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground">
            Passo {currentStep + 1} de {totalSteps}
          </span>
          <span className="text-[10px] font-medium text-primary">{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Instruction */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className={`rounded-xl p-4 ${
          isCelebration
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-muted/50 border border-border'
        }`}>
          {isCelebration && (
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600">Concluído!</span>
            </div>
          )}
          <p className="text-sm text-foreground leading-relaxed">
            {instruction}
          </p>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={isFirstStep}
            className="flex-1 text-xs h-9"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={onNext}
            className={`flex-1 text-xs h-9 ${
              isLastStep ? 'bg-emerald-600 hover:bg-emerald-700' : ''
            }`}
          >
            {isLastStep ? 'Concluir' : 'Próximo'}
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
