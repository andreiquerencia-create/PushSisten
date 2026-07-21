export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-zinc-950/70 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" />
          PushSisten
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
          <a href="#historia" className="hover:text-white transition-colors">Como funciona</a>
          <a href="#inteligencia" className="hover:text-white transition-colors">Inteligência</a>
          <a href="#planos" className="hover:text-white transition-colors">Planos</a>
          <a href="#duvidas" className="hover:text-white transition-colors">Dúvidas</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="/login" className="text-sm text-zinc-300 hover:text-white px-3 py-1.5 transition-colors">Entrar</a>
          <a href="/signup" className="text-sm bg-white text-zinc-900 px-4 py-1.5 rounded-full font-medium hover:bg-zinc-200 transition-colors">
            Começar grátis
          </a>
        </div>
      </div>
    </header>
  );
}
