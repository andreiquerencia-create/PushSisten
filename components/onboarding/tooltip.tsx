'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, SkipForward } from 'lucide-react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface OnboardingTooltipProps {
  /** Selector CSS do elemento alvo */
  target: string;
  /** Texto principal */
  message: string;
  /** Posição relativa ao elemento */
  position?: TooltipPosition;
  /** Se mostra botão de ação */
  actionLabel?: string;
  onAction?: () => void;
  /** Se mostra botão pular */
  showSkip?: boolean;
  onSkip?: () => void;
  /** Se está ativo */
  active: boolean;
}

export function OnboardingTooltip({
  target,
  message,
  position = 'bottom',
  actionLabel,
  onAction,
  showSkip = false,
  onSkip,
  active,
}: OnboardingTooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [arrowStyle, setArrowStyle] = useState<string>('');

  useEffect(() => {
    if (!active) {
      setCoords(null);
      return;
    }

    const calculate = () => {
      const el = document.querySelector(target) as HTMLElement | null;
      if (!el) {
        setCoords(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 120;
      const gap = 16;

      let top = 0;
      let left = 0;
      let arrow = '';

      switch (position) {
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrow = 'top';
          break;
        case 'top':
          top = rect.top - tooltipHeight - gap;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrow = 'bottom';
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + gap;
          arrow = 'left';
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - gap;
          arrow = 'right';
          break;
      }

      // Clamp to viewport
      left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

      setCoords({ top, left });
      setArrowStyle(arrow);
    };

    const timeout = setTimeout(calculate, 150);
    window.addEventListener('resize', calculate);
    window.addEventListener('scroll', calculate);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', calculate);
      window.removeEventListener('scroll', calculate);
    };
  }, [target, position, active]);

  if (!active || !coords) return null;

  return (
    <div
      className="fixed z-[9999] w-80 animate-in fade-in zoom-in-95 duration-300"
      style={{ top: coords.top, left: coords.left }}
    >
      {/* Arrow */}
      {arrowStyle === 'top' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-card border-l border-t border-border" />
      )}
      {arrowStyle === 'bottom' && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-card border-r border-b border-border" />
      )}
      {arrowStyle === 'left' && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-card border-l border-b border-border" />
      )}
      {arrowStyle === 'right' && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-card border-r border-t border-border" />
      )}

      {/* Content card */}
      <div className="relative bg-card border border-border rounded-xl p-4 shadow-xl">
        <p className="text-sm text-foreground leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        {(actionLabel || showSkip) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            {showSkip && (
              <button
                onClick={onSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <SkipForward className="w-3 h-3" />
                Pular
              </button>
            )}
            {actionLabel && (
              <Button
                size="sm"
                onClick={onAction}
                className="ml-auto text-xs h-7 px-3 gap-1"
              >
                {actionLabel}
                <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
