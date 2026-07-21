'use client';

import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span className="font-semibold text-gray-900">PushSisten</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/login" className="hover:text-gray-900 transition-colors">Entrar</Link>
            <Link href="/signup" className="hover:text-gray-900 transition-colors">Criar conta</Link>
            <a href="#" className="hover:text-gray-900 transition-colors">Termos</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Privacidade</a>
          </div>

          {/* Copyright */}
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} PushSisten. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
