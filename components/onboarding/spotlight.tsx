'use client';

import { useEffect, useState, useRef } from 'react';

interface SpotlightProps {
  /** CSS selector do elemento alvo */
  target: string;
  /** Se ativo */
  active: boolean;
  /** Callback quando o overlay de fundo é clicado */
  onBackdropClick?: () => void;
}

export function Spotlight({ target, active, onBackdropClick }: SpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    };

    // Update immediately and then poll (for layout shifts)
    const timeout = setTimeout(updatePosition, 100);
    intervalRef.current = setInterval(updatePosition, 1000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [target, active]);

  if (!active || !rect) return null;

  const padding = 8;

  // Use pointer-events-none on backdrop so clicks pass through to the highlighted element
  return (
    <>
      {/* Backdrop with hole — uses box-shadow to create the darkened area */}
      <div
        className="fixed z-[9998] pointer-events-none transition-all duration-300 ease-out"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          borderRadius: 12,
          boxShadow: `
            0 0 0 9999px rgba(0, 0, 0, 0.3),
            0 0 0 3px hsl(var(--primary)),
            0 0 20px 4px hsl(var(--primary) / 0.3)
          `,
          background: 'transparent',
        }}
      >
        {/* Pulse ring animation */}
        <div
          className="absolute inset-0 rounded-xl opacity-30"
          style={{
            border: '2px solid hsl(var(--primary))',
            borderRadius: 12,
            animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
      </div>
    </>
  );
}
