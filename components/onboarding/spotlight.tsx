'use client';

import { useEffect, useState, useRef } from 'react';

interface SpotlightProps {
  /** CSS selector do elemento alvo (ou data-onboarding attribute) */
  target: string;
  /** Se ativo */
  active: boolean;
  /** Callback quando o overlay de fundo é clicado */
  onBackdropClick?: () => void;
}

export function Spotlight({ target, active, onBackdropClick }: SpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }

    const updatePosition = () => {
      const el = document.querySelector(target) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
      } else {
        setRect(null);
      }
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    // Small delay to let the DOM settle
    const timeout = setTimeout(() => {
      updatePosition();
    }, 100);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, active]);

  if (!active || !rect) return null;

  const padding = 8;
  const borderRadius = 12;

  return (
    <>
      {/* Backdrop overlay — sutil, não opressivo */}
      <div
        className="fixed inset-0 z-[9998] transition-opacity duration-300"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
        onClick={onBackdropClick}
      />

      {/* Cutout — área visível com borda animada */}
      <div
        className="fixed z-[9998] pointer-events-none transition-all duration-300 ease-out"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          borderRadius: borderRadius,
          boxShadow: `
            0 0 0 9999px rgba(0, 0, 0, 0.35),
            0 0 0 3px hsl(var(--primary)),
            0 0 20px 4px hsl(var(--primary) / 0.3)
          `,
          background: 'transparent',
        }}
      >
        {/* Pulse ring animation */}
        <div
          className="absolute inset-0 rounded-xl animate-ping opacity-20"
          style={{
            border: '2px solid hsl(var(--primary))',
            borderRadius: borderRadius,
            animationDuration: '2s',
          }}
        />
      </div>

      {/* Allow clicks through to the highlighted element */}
      <div
        className="fixed z-[9999] cursor-pointer"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          borderRadius: borderRadius,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
