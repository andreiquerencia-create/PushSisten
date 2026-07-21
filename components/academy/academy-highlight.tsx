'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { GraduationCap, ArrowLeft } from 'lucide-react';

/**
 * Destaque do Push Academy após as boas-vindas.
 * Mostra fundo fosco na área principal + card explicativo.
 * Desaparece quando o usuário clica no Push Academy pela primeira vez.
 */
export function AcademyHighlight() {
  const { data: session, status } = useSession();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setLoading(false);
      return;
    }

    const checkShow = () => {
      fetch('/api/academy-progress')
        .then(res => res.json())
        .then(data => {
          const progress = data.progress || [];
          const welcomeSeen = progress.some((p: any) => p.moduleId === '_welcome');
          const highlightSeen = progress.some((p: any) => p.moduleId === '_highlight');
          // Mostra destaque se: boas-vindas já foram vistas MAS o highlight ainda não
          if (welcomeSeen && !highlightSeen) {
            setShow(true);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    checkShow();

    // Escutar quando as boas-vindas são dispensadas
    const handleWelcomeDismissed = () => {
      checkShow();
    };

    window.addEventListener('academy-welcome-dismissed', handleWelcomeDismissed);
    return () => window.removeEventListener('academy-welcome-dismissed', handleWelcomeDismissed);
  }, [session?.user, status]);

  // Escutar clique no Push Academy para desativar o highlight
  useEffect(() => {
    if (!show) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href="/push-academy"]');
      if (link) {
        setShow(false);
        // Marcar como visto
        fetch('/api/academy-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: '_highlight', currentStep: 1, totalSteps: 1, status: 'completed' }),
        }).catch(console.error);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [show]);

  if (loading || !show) return null;

  return (
    <>
      {/* Overlay fosco sobre a área de conteúdo principal */}
      <div className="fixed inset-0 z-[50] pointer-events-none">
        {/* Só escurece a área da main (não o sidebar) */}
        <div className="absolute top-0 bottom-0 left-[var(--sidebar-width,240px)] right-0 bg-black/40" />
      </div>

      {/* Card explicativo centralizado na main */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/4 -translate-y-1/2 z-[51] w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        <div className="bg-card rounded-2xl border border-primary/20 shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">Aprenda a usar o PushSisten</h3>
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed">
            É rápido e fácil. O Push Academy te guia passo a passo em cada funcionalidade do sistema.
          </p>

          <p className="text-sm text-foreground/80 leading-relaxed">
            Sempre que tiver dúvida, volte aqui.
          </p>

          <div className="flex items-center gap-2 text-primary font-medium text-sm pt-2">
            <ArrowLeft className="w-4 h-4 animate-pulse" />
            <span>Clique em <strong>Push Academy</strong> no menu</span>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook para saber se o highlight do Academy está ativo.
 * Usado pelo sidebar para aplicar classe de pulso no item.
 */
export function useAcademyHighlightActive() {
  const { data: session, status } = useSession();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const check = () => {
      fetch('/api/academy-progress')
        .then(res => res.json())
        .then(data => {
          const progress = data.progress || [];
          const welcomeSeen = progress.some((p: any) => p.moduleId === '_welcome');
          const highlightSeen = progress.some((p: any) => p.moduleId === '_highlight');
          setActive(welcomeSeen && !highlightSeen);
        })
        .catch(console.error);
    };

    check();

    // Escutar eventos
    const handleWelcome = () => check();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href="/push-academy"]');
      if (link) setActive(false);
    };

    window.addEventListener('academy-welcome-dismissed', handleWelcome);
    document.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('academy-welcome-dismissed', handleWelcome);
      document.removeEventListener('click', handleClick);
    };
  }, [session?.user, status]);

  return active;
}
