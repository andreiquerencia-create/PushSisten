export function LandingComparison() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-semibold text-zinc-100">A diferença no seu dia</h2>
        <p className="mt-3 text-zinc-400">A mesma loja. Uma rotina completamente diferente.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-800 p-8 bg-zinc-900/30">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Administrando no improviso</p>
          <ul className="mt-6 space-y-4 text-sm text-zinc-400">
            <li className="flex gap-3"><span className="text-zinc-600">✕</span>Decisões no improviso, contando com a memória</li>
            <li className="flex gap-3"><span className="text-zinc-600">✕</span>Produtos importantes acabam sem aviso</li>
            <li className="flex gap-3"><span className="text-zinc-600">✕</span>Clientes que somem e você nem percebe</li>
            <li className="flex gap-3"><span className="text-zinc-600">✕</span>Fim do dia com a sensação de que algo passou</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-500/30 p-8 bg-amber-500/5">
          <p className="text-xs uppercase tracking-widest text-amber-300">Administrando com o PushSisten</p>
          <ul className="mt-6 space-y-4 text-sm text-zinc-200">
            <li className="flex gap-3"><span className="text-amber-300">✓</span>Um passo a passo claro logo pela manhã</li>
            <li className="flex gap-3"><span className="text-amber-300">✓</span>Aviso antes de faltar o que mais vende</li>
            <li className="flex gap-3"><span className="text-amber-300">✓</span>Lembrete para reativar quem parou de comprar</li>
            <li className="flex gap-3"><span className="text-amber-300">✓</span>Tranquilidade de que nada ficou para trás</li>
          </ul>
        </div>
      </div>
    </section>
  );
}