export function LandingHero() {
  return (
    <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
      <p className="text-sm text-zinc-400 mb-6">Gestão inteligente para a sua loja</p>
      <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] bg-gradient-to-br from-amber-50 via-amber-100/70 to-amber-200/40 bg-clip-text text-transparent">
        Pare de apagar incêndios.<br />Administre sua loja com inteligência.
      </h1>
      <div className="mt-10 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
      <p className="mt-10 text-zinc-400 max-w-xl mx-auto leading-relaxed">
        Sua loja fala com você todos os dias. O PushSisten traduz essa conversa e mostra exatamente onde agir — direto do seu celular.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
        <a href="/signup" className="bg-white text-zinc-900 px-5 py-2.5 rounded-full font-medium hover:bg-zinc-200 transition-colors">Começar teste grátis</a>
        <a href="/login" className="text-zinc-300 px-5 py-2.5 rounded-full font-medium border border-zinc-800 hover:border-zinc-700 transition-colors">Entrar</a>
      </div>
      <p className="mt-5 text-xs text-zinc-500">14 dias grátis • sem cartão de crédito • cancele quando quiser</p>

      {/* Phone mockup */}
      <div className="mt-16 mx-auto w-[300px] rounded-[44px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
        <div className="rounded-[36px] bg-zinc-950 overflow-hidden border border-zinc-800/50">
          <div className="relative px-5 pt-4 pb-3 flex justify-between text-xs font-semibold">
            <span>9:41</span>
            <span className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-6 bg-zinc-900 rounded-full" />
            <span>•••</span>
          </div>
          <div className="px-5 pb-6 text-left">
            <p className="text-zinc-400 text-xs">Bom dia, Andrei</p>
            <p className="text-zinc-500 text-xs">Terça, 21 de julho</p>
            <h3 className="mt-4 text-base font-semibold">Seu dia começa aqui</h3>
            <p className="text-xs text-zinc-400 mt-1">Você tem 3 orientações para hoje. Nada foi esquecido.</p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] text-zinc-400">
              <div><div className="w-8 h-8 mx-auto rounded-lg bg-zinc-900 mb-1" />Financeiro</div>
              <div><div className="w-8 h-8 mx-auto rounded-lg bg-zinc-900 mb-1" />Estoque</div>
              <div><div className="w-8 h-8 mx-auto rounded-lg bg-zinc-900 mb-1" />Vendas</div>
              <div><div className="w-8 h-8 mx-auto rounded-lg bg-zinc-900 mb-1" />Clientes</div>
            </div>
            <div className="mt-5 rounded-xl border border-zinc-800 p-3">
              <p className="text-[11px] text-zinc-400">Vendas de hoje</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">R$ 1.240</span>
                <span className="text-xs text-emerald-400">+18%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
