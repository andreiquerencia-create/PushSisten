'use client';

import { useState, useRef } from 'react';
import { useAcademy } from './academy-context';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, GraduationCap, CheckCircle2, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Painel lateral fixo do Push Academy.
 * Desktop: coluna direita 320px.
 * Mobile: card minimizável no bottom.
 */
export function AcademyPanel() {
  const { state, nextStep, prevStep, exitAcademy } = useAcademy();
  const router = useRouter();
  const currentPath = usePathname();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Detectar se está no PDV (bottom tem botões importantes no mobile)
  const isPdv = currentPath.startsWith('/pdv');

  if (!state.isActive || !state.module) return null;

  const currentStepData = state.module.steps[state.currentStep];
  if (!currentStepData) return null;

  const progressPercent = state.totalSteps > 0 ? Math.round(((state.currentStep + 1) / state.totalSteps) * 100) : 0;
  const isLastStep = state.currentStep >= state.totalSteps - 1;
  const isFirstStep = state.currentStep === 0;
  const isCelebration = currentStepData.celebration;

  const handleNext = () => {
    const nextStepData = state.module!.steps[state.currentStep + 1];
    nextStep();
    if (isLastStep) {
      router.push('/push-academy');
    } else if (nextStepData?.route) {
      router.push(nextStepData.route);
    }
  };

  const handlePrev = () => {
    if (isFirstStep) return;
    const prevStepData = state.module!.steps[state.currentStep - 1];
    prevStep();
    if (prevStepData?.route) {
      router.push(prevStepData.route);
    }
  };

  const handleExit = () => {
    exitAcademy();
    router.push('/push-academy');
  };

  const formatBody = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i} className="block mb-1">
        {line}
      </span>
    ));
  };

  // ─── MOBILE VERSION ───
  // Pill arrastável + modal central
  const [pillPos, setPillPos] = useState({ x: -1, y: -1 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const getDefaultPillPos = () => ({
    x: (typeof window !== 'undefined' ? window.innerWidth : 400) - 80,
    y: (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.65,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const pos = pillPos.x === -1 ? getDefaultPillPos() : pillPos;
    dragStartRef.current = { startX: touch.clientX, startY: touch.clientY, startPosX: pos.x, startPosY: pos.y };
    setDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.startX;
    const dy = touch.clientY - dragStartRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) setDragging(true);
    setPillPos({
      x: Math.max(40, Math.min(dragStartRef.current.startPosX + dx, (window?.innerWidth || 400) - 40)),
      y: Math.max(80, Math.min(dragStartRef.current.startPosY + dy, (window?.innerHeight || 800) - 40)),
    });
  };

  const handleTouchEnd = () => {
    dragStartRef.current = null;
    setTimeout(() => setDragging(false), 100);
  };

  const pillPosition = pillPos.x === -1 ? getDefaultPillPos() : pillPos;

  const MobilePanel = () => (
    <div className="fixed inset-0 z-[100] lg:hidden pointer-events-none">
      {/* Minimized: pill grande, arrastável, chamativa */}
      {!mobileExpanded && (
        <div
          className="pointer-events-auto absolute animate-in fade-in duration-300"
          style={{ left: pillPosition.x, top: pillPosition.y, transform: 'translate(-50%, -50%)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={() => !dragging && setMobileExpanded(true)}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-white shadow-xl shadow-primary/30 text-sm font-semibold active:scale-95 transition-transform"
          >
            <GraduationCap className="w-5 h-5" />
            <span>{state.currentStep + 1}/{state.totalSteps}</span>
            <ChevronUp className="w-4 h-4 opacity-70" />
          </button>
        </div>
      )}

      {/* Expanded: modal central */}
      {mobileExpanded && (
        <>
          {/* Backdrop */}
          <div className="pointer-events-auto absolute inset-0 bg-black/40" onClick={() => setMobileExpanded(false)} />
          {/* Modal */}
          <div className="pointer-events-auto absolute inset-x-4 top-1/2 -translate-y-1/2 bg-card rounded-2xl shadow-2xl max-h-[75vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Push Academy</span>
                <span className="text-[10px] text-muted-foreground">• {state.module!.title}</span>
              </div>
              <button onClick={() => setMobileExpanded(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress */}
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Passo {state.currentStep + 1} de {state.totalSteps}</span>
                <span className="text-[10px] font-medium text-primary">{progressPercent}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className={`rounded-lg px-3 py-2 mb-3 ${
                isCelebration
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-primary/5 border border-primary/20'
              }`}>
                <div className="flex items-center gap-2">
                  {isCelebration ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />}
                  <h4 className={`text-sm font-semibold ${isCelebration ? 'text-emerald-700 dark:text-emerald-400' : 'text-primary'}`}>{currentStepData.title}</h4>
                </div>
              </div>
              <div className="text-sm text-foreground/80 leading-relaxed space-y-1">
                {formatBody(currentStepData.body)}
              </div>
            </div>

            {/* Navigation */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { handlePrev(); setMobileExpanded(false); }} disabled={isFirstStep} className="flex-1 text-xs h-9">
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />Voltar
                </Button>
                <Button size="sm" onClick={() => { handleNext(); setMobileExpanded(false); }} className={`flex-1 text-xs h-9 ${isLastStep ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                  {isLastStep ? 'Concluir 🎉' : 'Próximo'}<ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ─── DESKTOP VERSION (side panel) ───
  const DesktopPanel = () => (
    <div className="hidden lg:flex fixed top-0 right-0 bottom-0 w-80 z-[100] flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">Push Academy</span>
        </div>
        <button onClick={handleExit} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Sair do treinamento">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Module + progress */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{state.module!.icon}</span>
          <span className="text-xs text-muted-foreground font-medium">{state.module!.title}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Passo {state.currentStep + 1} de {state.totalSteps}</span>
          <span className="text-[10px] font-medium text-primary">{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        <div className={`rounded-lg px-3 py-2 mb-3 ${
          isCelebration
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-primary/5 border border-primary/20'
        }`}>
          <div className="flex items-center gap-2">
            {isCelebration ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />}
            <h4 className={`text-sm font-semibold ${isCelebration ? 'text-emerald-700 dark:text-emerald-400' : 'text-primary'}`}>{currentStepData.title}</h4>
          </div>
        </div>
        <div className="text-sm text-foreground/80 leading-relaxed space-y-1">
          {formatBody(currentStepData.body)}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} disabled={isFirstStep} className="flex-1 text-xs h-9">
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />Voltar
          </Button>
          <Button size="sm" onClick={handleNext} className={`flex-1 text-xs h-9 ${isLastStep ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
            {isLastStep ? 'Concluir 🎉' : 'Próximo'}<ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <DesktopPanel />
      <MobilePanel />
    </>
  );
}
