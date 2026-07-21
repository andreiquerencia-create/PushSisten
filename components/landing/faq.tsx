export function LandingFaq() {
  return (
    <section id="duvidas" className="max-w-2xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-semibold text-zinc-100">Dúvidas frequentes</h2>
        <p className="mt-3 text-zinc-400">O que os lojistas costumam perguntar.</p>
      </div>
      <div className="space-y-3">
        {[
          { q: 'Preciso entender de tecnologia para usar?', a: 'Não. A interface foi feita em linguagem simples, com orientações e um gerente que responde em português claro.' },
          { q: 'Funciona para o meu tipo de loja?', a: 'Sim. Foi pensado para lojas de roupas, calçados, acessórios, bazares, brechós e varejo em geral.' },
          { q: 'Meus dados ficam seguros?', a: 'Sim. Usamos criptografia e servidores com boas práticas de segurança. Seus dados são seus.' },
          { q: 'Como funciona o teste grátis?', a: '14 dias com acesso completo, sem cartão de crédito. Cancele quando quiser.' },
          { q: 'Posso cancelar quando quiser?', a: 'Pode. Sem multa, sem burocracia. Você controla quando e por quanto tempo fica.' },
        ].map((item, i) => (
          <details key={i} className="group rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-4">
            <summary className="flex justify-between items-center cursor-pointer list-none">
              <span className="font-medium text-zinc-100">{item.q}</span>
              <span className="chev transition-transform text-zinc-500">⌃</span>
            </summary>
            <p className="mt-3 text-sm text-zinc-400">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}