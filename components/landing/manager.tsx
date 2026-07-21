export function LandingManager() {
  return (
    <>
      {/* Push Score Feature */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-4xl font-semibold tracking-tight text-amber-200">Push Score</p>
            <p className="mt-2 text-zinc-500 text-sm">A saúde da sua loja, em um número</p>
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-semibold text-zinc-100">O Push Score mostra, num piscar de olhos, como sua loja está indo.</h3>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Sem se perder em relatórios. Uma única medida reúne vendas, estoque e financeiro para dizer, com clareza, onde você está forte e onde vale olhar com carinho.
            </p>
          </div>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h4 className="font-semibold text-zinc-100">Vendas em crescimento</h4>
            <p className="mt-2 text-sm text-zinc-400">Você vê o ritmo do seu faturamento sem abrir uma planilha.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h4 className="font-semibold text-zinc-100">Estoque equilibrado</h4>
            <p className="mt-2 text-sm text-zinc-400">Nem falta o que vende, nem sobra dinheiro parado na prateleira.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h4 className="font-semibold text-zinc-100">Financeiro saudável</h4>
            <p className="mt-2 text-sm text-zinc-400">Contas em dia e caixa positivo, com avisos antes do vencimento.</p>
          </div>
        </div>
      </section>

      {/* Gerente Inteligente */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-10 md:p-16 text-center">
          <p className="text-xs uppercase tracking-widest text-amber-300">Inteligência</p>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold text-zinc-100">Um gerente sempre com você</h2>
          <p className="mt-5 text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Tenha um gerente inteligente trabalhando com você todos os dias. Pergunte em linguagem simples, como quem conversa com um sócio de confiança. Ele conhece a sua loja, responde na hora e já aponta o próximo passo — sem termos técnicos, sem enrolação.
          </p>
        </div>
      </section>
    </>
  );
}