'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface OnboardingCelebrationProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  autoClose?: number; // ms para fechar automaticamente
}

export function OnboardingCelebration({
  emoji = '✨',
  title,
  subtitle,
  actionLabel,
  onAction,
  autoClose,
}: OnboardingCelebrationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoClose && onAction) {
      const timer = setTimeout(() => {
        setVisible(false);
        onAction();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onAction]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="text-center space-y-4 px-6 animate-in zoom-in-95 duration-300">
        <div className="text-5xl">{emoji}</div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
        {actionLabel && onAction && (
          <Button onClick={onAction} size="lg" className="mt-4">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
