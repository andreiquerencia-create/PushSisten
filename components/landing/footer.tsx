export function LandingFooter() {
  return (
    <>
      {/* CTA Final */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Capítulo final · Comece hoje</p>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold bg-gradient-to-br from-amber-50 to-amber-100/60 bg-clip-text text-transparent">
          Sua loja já está falando com você. Que tal começar a ouvir hoje?
        </h2>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          Experimente o PushSisten completo por 14 dias. Sem cartão, sem compromisso — só a tranquilidade de administrar com clareza.
        </p>
        <a href="/signup" className="mt-9 inline-block bg-white text-zinc-900 px-6 py-3 rounded-full font-medium hover:bg-zinc-200 transition-colors">Começar teste grátis</a>
        <p className="mt-4 text-xs text-zinc-500">14 dias grátis • sem cartão de crédito • cancele quando quiser</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" />
            <span className="font-semibold text-zinc-100">PushSisten</span>
          </div>
          <nav className="flex items-center gap-6 text-zinc-400">
            <a href="#historia" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="/login" className="hover:text-white transition-colors">Entrar</a>
          </nav>
          <p className="text-xs text-zinc-500">© 2026 PushSisten</p>
        </div>
      </footer>
    </>
  );
}