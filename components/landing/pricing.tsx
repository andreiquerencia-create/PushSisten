export function LandingPricing() {
  return (
    <section id="planos" className="max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-semibold text-zinc-100">Planos que cabem no seu momento</h2>
        <p className="mt-3 text-zinc-400">Comece de graça. Cresça quando fizer sentido.</p>
        <p className="mt-2 text-xs text-zinc-500">Experimente tudo por 14 dias, sem cartão de crédito. Depois escolha o plano no seu ritmo.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {/* Organização */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-7 flex flex-col">
          <h3 className="font-semibold text-lg text-zinc-100">Organização</h3>
          <p className="mt-2 text-sm text-zinc-400 min-h-[3em]">Organize sua loja e gerencie seu negócio de forma profissional.</p>
          <p className="mt-6 text-3xl font-semibold text-zinc-100">R$ 39,90<span className="text-sm font-normal text-zinc-400">/mês</span></p>
          <ul className="mt-6 space-y-2.5 text-sm text-zinc-300 flex-1">
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Até 2 usuários</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Acesso completo a todos os módulos</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>PDV, estoque e financeiro completos</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Central do Dia diária</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Suporte por WhatsApp</li>
          </ul>
          <a href="/signup" className="mt-7 text-center px-4 py-2.5 rounded-full border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-300 transition-colors block">Começar teste grátis</a>
        </div>
        {/* Evolução */}
        <div className="relative rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-zinc-900/30 p-7 flex flex-col">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-amber-300 text-zinc-900 px-3 py-1 rounded-full font-medium">Mais popular</span>
          <h3 className="font-semibold text-lg text-zinc-100">Evolução</h3>
          <p className="mt-2 text-sm text-zinc-400 min-h-[3em]">Mais inteligência e indicadores para decidir com segurança.</p>
          <p className="mt-6 text-3xl font-semibold text-zinc-100">R$ 57,00<span className="text-sm font-normal text-zinc-400">/mês</span></p>
          <ul className="mt-6 space-y-2.5 text-sm text-zinc-300 flex-1">
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Até 10 usuários</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Tudo do Organização</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Gerente inteligente e análise de estoque</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Indicadores e insights aprofundados</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Suporte prioritário</li>
          </ul>
          <a href="/signup" className="mt-7 text-center px-4 py-2.5 rounded-full bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors block">Começar teste grátis</a>
        </div>
        {/* Expansão */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-7 flex flex-col">
          <h3 className="font-semibold text-lg text-zinc-100">Expansão</h3>
          <p className="mt-2 text-sm text-zinc-400 min-h-[3em]">Estruture sua operação para crescer em escala.</p>
          <p className="mt-6 text-3xl font-semibold text-zinc-100">R$ 97,00<span className="text-sm font-normal text-zinc-400">/mês</span></p>
          <ul className="mt-6 space-y-2.5 text-sm text-zinc-300 flex-1">
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Até 25 usuários</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Tudo do Evolução</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Gestão para equipe e processos</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Ideal para redes e lojas maiores</li>
            <li className="flex gap-2"><span className="text-amber-300">✓</span>Atendimento premium</li>
          </ul>
          <a href="/signup" className="mt-7 text-center px-4 py-2.5 rounded-full border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-300 transition-colors block">Começar teste grátis</a>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-zinc-500">Todos os planos incluem os 14 dias de teste gratuito com acesso completo.</p>
    </section>
  );
}