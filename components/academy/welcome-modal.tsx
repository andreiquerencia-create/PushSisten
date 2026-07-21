'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';

/**
 * Modal de boas-vindas — aparece APENAS no primeiro login.
 * Após clicar "Entendi", nunca mais aparece.
 */
export function WelcomeModal() {
  const { data: session, status } = useSession();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setLoading(false);
      return;
    }

    // Verificar se já viu as boas-vindas
    fetch('/api/academy-progress')
      .then(res => res.json())
      .then(data => {
        const progress = data.progress || [];
        const welcomeSeen = progress.some((p: any) => p.moduleId === '_welcome');
        if (!welcomeSeen) {
          setShow(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session?.user, status]);

  const handleDismiss = async () => {
    setShow(false);
    // Marcar como visto
    await fetch('/api/academy-progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: '_welcome', currentStep: 1, totalSteps: 1, status: 'completed' }),
    }).catch(console.error);
    // Disparar evento para ativar o highlight
    window.dispatchEvent(new CustomEvent('academy-welcome-dismissed'));
  };

  if (loading || !show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-transparent px-6 pt-8 pb-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Bem-vindo ao PushSisten!
          </h1>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Para colocar sua loja para funcionar, preparamos um guia prático que leva poucos minutos e você já aprende tudo do sistema.
          </p>

          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <p className="text-sm text-foreground font-medium flex items-start gap-2">
              <span className="text-base">📌</span>
              <span>No menu lateral, clique em <strong className="text-primary">"Push Academy"</strong> para começar.</span>
            </p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            O Academy vai te guiar passo a passo nas telas reais do sistema. Você aprende fazendo.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button onClick={handleDismiss} className="w-full h-11 text-sm font-semibold">
            Entendi, vamos lá! →
          </Button>
        </div>
      </div>
    </div>
  );
}
