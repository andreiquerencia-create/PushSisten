export function LandingStory() {
  return (
    <>
      {/* Capítulo 1 */}
      <section id="historia" className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo 1 · O problema existe</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          Você fecha a loja cansado, mas com a sensação de que algo passou batido.
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          Contas para lembrar, produtos acabando, clientes que sumiram. Tudo na cabeça, ao mesmo tempo. No fim do dia, a dúvida: será que decidi certo?
        </p>
      </section>

      {/* Capítulo 2 */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo 2 · Você não está sozinho</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          Todo lojista conhece esse peso. Você não precisa carregá-lo sozinho.
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          Administrar no improviso cansa e faz você perder dinheiro sem perceber. O problema nunca foi você — foi nunca ter tido quem organizasse tudo por você.
        </p>

        {/* Central do Dia mockup */}
        <div className="mt-14 mx-auto w-[320px] text-left rounded-[44px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
          <div className="rounded-[36px] bg-zinc-950 p-5 border border-zinc-800/50">
            <div className="flex justify-between text-xs font-semibold mb-3"><span>9:41</span><span>•••</span></div>
            <p className="text-xs text-zinc-400">Central do Dia</p>
            <h4 className="font-semibold">Seu gerente já organizou tudo</h4>
            <p className="text-[11px] text-zinc-500 mt-1">O que importa hoje</p>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex gap-2"><span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-300" />Confira 2 boletos que vencem hoje</li>
              <li className="flex gap-2"><span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-300" />Reponha a calça jeans que está acabando</li>
              <li className="flex gap-2"><span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-300" />Fale com 3 clientes que sumiram</li>
            </ul>
            <div className="mt-4 p-3 rounded-xl border border-emerald-900/40 bg-emerald-950/30 text-[11px] text-emerald-300">
              <span className="font-semibold">Aviso importante:</span> Seu caixa fechou positivo ontem. Continue assim.
            </div>
          </div>
        </div>
      </section>

      {/* Capítulo 3 */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo 3 · Sua loja tem as respostas</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          Cada venda e cada produto parado é um recado da sua loja.
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          A sua operação gera respostas todos os dias. Só faltava alguém para ouvir com atenção e mostrar o que elas significam.
        </p>
      </section>

      {/* Capítulo 4 */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo 4 · O PushSisten traduz</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          Ele escuta esses recados e traduz em passos simples.
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          Em vez de planilhas e relatórios frios, você recebe orientações claras: reponha isto, fale com aquele cliente, cuide dessa conta antes que ela vire problema.
        </p>

        {/* Financeiro mockup */}
        <div className="mt-14 mx-auto w-[320px] text-left rounded-[44px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
          <div className="rounded-[36px] bg-zinc-950 p-5 border border-zinc-800/50">
            <div className="flex justify-between text-xs font-semibold mb-3"><span>9:41</span><span>•••</span></div>
            <p className="text-xs text-zinc-400">Financeiro</p>
            <p className="text-[11px] text-zinc-500">Últimos 7 dias</p>
            <h4 className="font-semibold mt-1">Faturamento na semana</h4>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">R$ 8.430</span>
              <span className="text-xs text-emerald-400">+24%</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
              <div className="rounded-lg border border-zinc-800 p-2.5">
                <p className="text-zinc-500">A receber</p>
                <p className="font-semibold mt-1">R$ 2.180</p>
              </div>
              <div className="rounded-lg border border-zinc-800 p-2.5">
                <p className="text-zinc-500">A pagar</p>
                <p className="font-semibold mt-1">R$ 940</p>
              </div>
            </div>
            <div className="mt-3 h-16 rounded-lg bg-gradient-to-t from-amber-500/20 to-transparent border border-amber-500/20" />
          </div>
        </div>
      </section>

      {/* Capítulo 5 */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo 5 · Agora você entende</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          Você passa a entender sua loja como nunca antes.
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          Uma única medida mostra a saúde do seu negócio. Você vê o que está crescendo, o que precisa de atenção e para onde caminhar — sem se perder em números.
        </p>

        {/* Estoque mockup */}
        <div className="mt-14 mx-auto w-[320px] text-left rounded-[44px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
          <div className="rounded-[36px] bg-zinc-950 p-5 border border-zinc-800/50">
            <div className="flex justify-between text-xs font-semibold mb-3"><span>9:41</span><span>•••</span></div>
            <p className="text-xs text-zinc-400">Estoque</p>
            <p className="text-[11px] text-amber-300 mt-1">Antes de faltar</p>
            <h4 className="font-semibold mt-1">2 produtos importantes vão acabar</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex justify-between"><span>Calça Jeans Skinny</span><span className="text-amber-300">3 restantes</span></li>
              <li className="flex justify-between"><span>Camiseta Básica Branca</span><span className="text-amber-300">7 restantes</span></li>
              <li className="flex justify-between"><span>Vestido Floral</span><span className="text-zinc-400">21 restantes</span></li>
            </ul>
          </div>
        </div>

        {/* Push Score mockup */}
        <div className="mt-6 mx-auto w-[320px] text-left rounded-[44px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
          <div className="rounded-[36px] bg-zinc-950 p-5 border border-zinc-800/50">
            <div className="flex justify-between text-xs font-semibold mb-3"><span>9:41</span><span>•••</span></div>
            <p className="text-xs text-zinc-400">Push Score</p>
            <p className="text-[11px] text-zinc-500">A saúde da sua loja</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-5xl font-semibold text-amber-200">82</span>
              <span className="text-sm text-emerald-400">Muito bom</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-zinc-400">Vendas</span><span className="text-emerald-400">Crescendo</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Estoque</span><span className="text-emerald-400">Equilibrado</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Financeiro</span><span className="text-emerald-400">Saudável</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Capítulo 6 */}
      <section id="inteligencia" className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo 6 · Sua rotina muda</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          E aí a sua rotina muda de figura.
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          Você abre o dia sabendo exatamente o que fazer. Pergunta em linguagem simples e recebe respostas na hora. Decide com tranquilidade, no lugar de apagar incêndio.
        </p>

        {/* Chat mockup */}
        <div className="mt-14 mx-auto w-[320px] text-left rounded-[44px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
          <div className="rounded-[36px] bg-zinc-950 p-5 border border-zinc-800/50">
            <div className="flex justify-between text-xs font-semibold mb-3"><span>9:41</span><span>•••</span></div>
            <p className="text-xs text-zinc-400">Seu gerente</p>
            <p className="text-[11px] text-zinc-500">Pergunte o que quiser</p>
            <div className="mt-3 rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300">
              Como foi meu mês comparado ao anterior?
            </div>
            <div className="mt-2 inline-block max-w-full rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-100">
              Você vendeu 24% a mais. Seu ponto forte foi calçado feminino. Vale repor os 3 modelos que mais saíram.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
