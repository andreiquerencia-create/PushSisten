'use client';

/**
 * /billing/recusado — Página de PAGAMENTO NÃO CONCLUÍDO (P8.5)
 * ---------------------------------------------------------------------------
 * Tela dedicada de experiência (UX) para quando um pagamento é recusado,
 * o cartão não é autorizado ou a tentativa de assinatura não é concluída.
 *
 * Esta tela é PURAMENTE informativa/de navegação: NÃO altera nenhuma lógica
 * financeira, de cobrança ou de assinatura. Apenas orienta o lojista, com
 * linguagem simples, sobre o que pode ter acontecido e oferece próximos passos:
 *   1. Tentar novamente (voltar aos planos)
 *   2. Escolher outro plano (voltar aos planos)
 *   3. Falar no WhatsApp (suporte comercial)
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { XCircle, RefreshCw, LayoutGrid, MessageCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Canal oficial de suporte comercial.
const SUPPORT_WHATSAPP = '553991665889';

const MOTIVOS = [
  'O cartão não foi autorizado pelo banco emissor.',
  'Algum dado do cartão pode ter sido digitado incorretamente.',
  'Saldo ou limite insuficiente no momento da cobrança.',
  'A tentativa de pagamento não foi concluída até o final.',
];

export default function RecusadoContent() {
  const router = useRouter();

  const whatsappHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    'Olá! Tentei assinar o PushSisten, mas meu pagamento não foi concluído. Podem me ajudar?'
  )}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,40%,16%)] to-[hsl(217,50%,20%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-sm shadow-2xl p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg">
          <XCircle className="w-7 h-7 text-white" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold">Pagamento não concluído</h1>
          <p className="text-muted-foreground text-sm">
            Não se preocupe: nenhuma cobrança foi feita e seus dados continuam seguros.
            Sua assinatura ainda não foi ativada porque o pagamento não foi finalizado.
          </p>
        </div>

        {/* Possíveis motivos, em linguagem simples */}
        <div className="text-left rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            O que pode ter acontecido
          </div>
          <ul className="space-y-1.5">
            {MOTIVOS.map((m) => (
              <li key={m} className="flex items-start gap-2 text-[13px] text-slate-600">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Próximos passos */}
        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white"
            onClick={() => router.push('/planos')}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push('/planos')}>
            <LayoutGrid className="w-4 h-4 mr-2" /> Escolher outro plano
          </Button>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="ghost" className="w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
              <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
            </Button>
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground pt-1">
          Precisa de ajuda? Nossa equipe pode orientar você a concluir a assinatura com tranquilidade.
        </p>
      </div>
    </div>
  );
}
