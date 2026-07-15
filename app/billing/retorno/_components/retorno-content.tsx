'use client';

/**
 * /billing/retorno — Página de RETORNO do checkout (P8.4)
 * ---------------------------------------------------------------------------
 * O processador de pagamento redireciona o cliente para cá após o checkout.
 * - Modo SIMULADO (parâmetro mock_sub presente): exibe um botão para confirmar
 *   o pagamento aprovado, que dispara o webhook normalizado (valida todo o
 *   fluxo de cobrança sem um gateway real).
 * - Modo REAL: a confirmação chega de forma assíncrona via webhook; aqui apenas
 *   acompanhamos o status até a ativação.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, CreditCard, ArrowRight, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Phase = 'idle' | 'processing' | 'done' | 'error';

export default function RetornoContent() {
  const params = useSearchParams();
  const router = useRouter();
  const mockSub = params?.get('mock_sub') ?? null;
  const isMock = Boolean(mockSub);
  const [phase, setPhase] = useState<Phase>('idle');

  // Confirmação simulada: dispara o webhook de pagamento aprovado.
  const confirmMock = useCallback(async () => {
    if (!mockSub) return;
    setPhase('processing');
    try {
      const evt = {
        externalEventId: `mock_evt_${mockSub}_${Date.now()}`,
        kind: 'payment.approved',
        externalSubscriptionId: mockSub,
        externalPaymentId: `mock_pay_${Date.now()}`,
        rawType: 'payment',
      };
      const resp = await fetch('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evt),
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok && (json?.ok || json?.handled || json?.duplicate)) {
        setPhase('done');
        toast.success('Pagamento confirmado! Assinatura ativada.');
      } else {
        setPhase('error');
        toast.error('Não foi possível confirmar o pagamento simulado.');
      }
    } catch {
      setPhase('error');
      toast.error('Erro de conexão ao confirmar o pagamento.');
    }
  }, [mockSub]);

  // Modo real: acompanha o status (poll leve) até a ativação.
  useEffect(() => {
    if (isMock) return;
    let active = true;
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const r = await fetch('/api/billing/history');
        const d = await r.json().catch(() => ({}));
        if (active && d?.billingStatus === 'ACTIVE') { setPhase('done'); return; }
      } catch { /* ignora */ }
      if (active && tries < 10) setTimeout(tick, 3000);
    };
    setPhase('processing');
    tick();
    return () => { active = false; };
  }, [isMock]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,40%,16%)] to-[hsl(217,50%,20%)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-sm shadow-2xl p-8 text-center space-y-5">
        <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${phase === 'error' ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-violet-500 to-violet-600'}`}>
          {phase === 'done'
            ? <CheckCircle2 className="w-7 h-7 text-white" />
            : phase === 'error'
              ? <XCircle className="w-7 h-7 text-white" />
              : phase === 'processing'
                ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                : <CreditCard className="w-7 h-7 text-white" />}
        </div>

        {phase === 'error' ? (
          <>
            <h1 className="text-2xl font-display font-bold">Pagamento não concluído</h1>
            <p className="text-muted-foreground text-sm">
              Não foi possível concluir o pagamento desta vez. Nenhuma cobrança foi feita —
              você pode tentar novamente em instantes.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white"
                onClick={() => router.push('/billing/recusado')}
              >
                Ver o que fazer <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Link href="/planos"><Button variant="outline" className="w-full">Voltar aos planos</Button></Link>
            </div>
          </>
        ) : phase === 'done' ? (
          <>
            <h1 className="text-2xl font-display font-bold">Assinatura ativada!</h1>
            <p className="text-muted-foreground text-sm">
              Seu pagamento foi confirmado e o plano já está ativo. Bom trabalho!
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white" onClick={() => router.push('/plano')}>
                Ver meu plano <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Link href="/hoje"><Button variant="outline" className="w-full">Ir para o sistema</Button></Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold">
              {isMock ? 'Confirme seu pagamento' : 'Confirmando pagamento...'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isMock
                ? 'Ambiente de demonstração: confirme abaixo para simular a aprovação do pagamento e ativar a assinatura.'
                : 'Estamos aguardando a confirmação do processador de pagamento. Isso pode levar alguns instantes.'}
            </p>
            {isMock && (
              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                onClick={confirmMock}
                disabled={phase === 'processing'}
              >
                {phase === 'processing' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {phase === 'processing' ? 'Confirmando...' : 'Confirmar pagamento aprovado'}
              </Button>
            )}
            <Link href="/plano" className="block">
              <Button variant="ghost" className="w-full text-muted-foreground">Voltar ao meu plano</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
