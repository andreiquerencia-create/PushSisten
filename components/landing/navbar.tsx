'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-lg text-gray-900">PushSisten</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#como-funciona" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Como funciona</a>
            <a href="#funcionalidades" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Funcionalidades</a>
            <a href="#planos" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Planos</a>
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 h-9 text-sm font-medium shadow-sm">
                Começar teste grátis
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <a href="#como-funciona" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Como funciona</a>
            <a href="#funcionalidades" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Funcionalidades</a>
            <a href="#planos" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Planos</a>
            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <Link href="/login" className="text-sm text-gray-600 py-2">Entrar</Link>
              <Link href="/signup">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-10 text-sm font-medium">
                  Começar teste grátis
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
