'use client';

import { useState } from 'react';
import Image from 'next/image';

const BRAND = {
  name: 'PUSHY ERP',
  slogan: 'Sua operação guiada por inteligência.',
  tagline: 'Gestão operacional inteligente.',
  colors: [
    { name: 'Primary', hex: '#3B82F6', label: 'Electric Blue' },
    { name: 'Accent', hex: '#7C3AED', label: 'Tech Purple' },
    { name: 'Background', hex: '#0A0A0F', label: 'Graphite Black' },
    { name: 'Surface', hex: '#111827', label: 'Deep Navy' },
    { name: 'Success', hex: '#10B981', label: 'Emerald' },
    { name: 'Warning', hex: '#F59E0B', label: 'Amber' },
    { name: 'Danger', hex: '#EF4444', label: 'Red' },
    { name: 'Text', hex: '#F9FAFB', label: 'White' },
  ],
  typography: [
    { name: 'Display', font: 'Plus Jakarta Sans', weight: 'Bold', usage: 'Títulos, hero, KPIs' },
    { name: 'Body', font: 'Inter', weight: 'Regular / Medium', usage: 'Corpo de texto, labels, métricas' },
    { name: 'Code', font: 'JetBrains Mono', weight: 'Regular', usage: 'Valores monetários, códigos, dados' },
  ],
  images: [
    { src: '/images/brand/77969587-4798-4077-bf27-0c528341333e.png', title: 'Logo Principal', desc: 'Símbolo geométrico + wordmark sobre fundo escuro. Variação primária para todas as aplicações digitais.' },
    { src: '/images/brand/8d0aca9a-782c-4034-ae0e-5aa01c795f21.png', title: 'Dashboard Preview — Dark Mode', desc: 'Interface premium com glassmorphism, IA Gerente, gráficos inteligentes e métricas operacionais.' },
    { src: '/images/brand/2279c79b-00b5-4345-917b-da7c6ff0b6df.png', title: 'Brand Identity Spread', desc: 'Apresentação completa: logo, paleta, tipografia, componentes e referências visuais do design system.' },
    { src: '/images/brand/26c003b4-61b0-4fac-991c-307812af637b.png', title: 'App Icon', desc: 'Ícone minimalista para mobile, favicon e sidebar. Símbolo "P" com gradiente azul-roxo.' },
    { src: '/images/brand/868fcb4d-88da-4d02-b807-df3ba777e6d2.png', title: 'Login Screen Concept', desc: 'Tela de login split-screen premium. Marca à esquerda, formulário limpo à direita.' },
    { src: '/images/brand/ca69e437-f78b-49ca-9ea0-a2e6ca244295.png', title: 'Design System — Cores & Tipografia', desc: 'Referência técnica com swatches HEX, hierarquia tipográfica e escala de tamanhos.' },
  ],
};

export default function BrandPage() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F9FAFB]">

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#0A0A0F] to-[#0f0a1e]" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#3B82F6] blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#7C3AED] blur-[150px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
            <span className="text-xs font-medium text-white/60 tracking-wider uppercase">Brand Identity & Design System</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-[#3B82F6] via-[#818CF8] to-[#7C3AED] bg-clip-text text-transparent">
              PUSHY ERP
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/80 font-light mb-3">{BRAND.slogan}</p>
          <p className="text-sm text-white/40 tracking-widest uppercase">{BRAND.tagline}</p>
        </div>
      </section>

      {/* ===== BRAND ASSETS ===== */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-[#3B82F6] mb-2 font-medium">01</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Brand Assets</h2>
          <p className="text-white/40 mt-2 max-w-xl">Identidade visual completa do PUSHY ERP — logo, dashboard, design system e referências visuais para a evolução da interface.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BRAND.images.map((img, i) => (
            <div
              key={i}
              className={`group cursor-pointer ${i === 0 || i === 1 ? 'md:col-span-2' : ''} ${i === 3 ? 'md:col-span-1 max-w-sm mx-auto md:mx-0' : ''}`}
              onClick={() => setLightbox(i)}
            >
              <div className="bg-[#111827]/50 rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-[#3B82F6]/30 hover:shadow-[0_0_40px_rgba(59,130,246,0.08)]">
                <div className={`relative ${i === 3 ? 'aspect-square' : 'aspect-video'} bg-[#0A0A0F]`}>
                  <Image
                    src={img.src}
                    alt={img.title}
                    fill
                    className="object-contain group-hover:scale-[1.02] transition-transform duration-500"
                    unoptimized
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-sm font-semibold mb-1">{img.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{img.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== COLOR SYSTEM ===== */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-[#7C3AED] mb-2 font-medium">02</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Color System</h2>
          <p className="text-white/40 mt-2 max-w-xl">Paleta cromática premium com foco em legibilidade, hierarquia visual e identidade tecnológica.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {BRAND.colors.map((c) => (
            <div key={c.hex} className="group">
              <div
                className="aspect-[4/3] rounded-xl mb-3 border border-white/5 transition-transform duration-300 group-hover:scale-105 relative overflow-hidden"
                style={{ backgroundColor: c.hex }}
              >
                {c.hex === '#0A0A0F' && <div className="absolute inset-0 border border-white/10 rounded-xl" />}
              </div>
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-white/40 font-mono">{c.hex}</p>
              <p className="text-[10px] text-white/25">{c.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TYPOGRAPHY ===== */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-[#10B981] mb-2 font-medium">03</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Typography</h2>
          <p className="text-white/40 mt-2 max-w-xl">Sistema tipográfico com hierarquia clara — display para impacto, body para legibilidade, mono para dados.</p>
        </div>

        <div className="space-y-6">
          {BRAND.typography.map((t) => (
            <div key={t.name} className="bg-[#111827]/40 border border-white/5 rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                <div className="md:w-48 shrink-0">
                  <p className="text-xs text-[#3B82F6] tracking-wider uppercase mb-1">{t.name}</p>
                  <p className="text-sm font-semibold">{t.font}</p>
                  <p className="text-[10px] text-white/30">{t.weight}</p>
                </div>
                <div className="flex-1">
                  <p className={`text-2xl md:text-3xl tracking-tight ${
                    t.name === 'Display' ? 'font-display font-bold' :
                    t.name === 'Code' ? 'font-mono text-xl text-[#3B82F6]' : ''
                  }`}>
                    {t.name === 'Display' && 'Dashboard Inteligente'}
                    {t.name === 'Body' && 'Gestão operacional para lojas de roupas, calçados e acessórios com inteligência artificial integrada.'}
                    {t.name === 'Code' && 'R$ 127.450,00 — SKU-00142 — 30d'}
                  </p>
                </div>
                <div className="md:w-40 shrink-0">
                  <p className="text-[10px] text-white/25">{t.usage}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== UI PRINCIPLES ===== */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-[#F59E0B] mb-2 font-medium">04</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Design Principles</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'Inteligência Visível', desc: 'IA integrada naturalmente na interface — cards inteligentes, sugestões contextuais, insights automáticos. A tecnologia serve o operador.', icon: '🧠' },
            { title: 'Clareza Operacional', desc: 'Hierarquia visual forte. KPIs em destaque. Ações primárias óbvias. O lojista encontra o que precisa em segundos.', icon: '🎯' },
            { title: 'Premium Acessível', desc: 'Estética de startup de tecnologia, mas linguagem de quem vende roupa. Sofisticação sem intimidar.', icon: '✨' },
            { title: 'Dark Mode First', desc: 'Interface escura como padrão. Reduz fadiga visual em longas jornadas. Glow effects sutis para feedback.', icon: '🌙' },
            { title: 'Dados como Narrativa', desc: 'Gráficos contam histórias. Números têm contexto. Comparações temporais automáticas. Insights > planilhas.', icon: '📊' },
            { title: 'Escala SaaS', desc: 'Design system componentizado. Temas por cliente. Performance mobile-first. Pronto para multi-tenant.', icon: '🚀' },
          ].map((p) => (
            <div key={p.title} className="bg-[#111827]/40 border border-white/5 rounded-2xl p-6 hover:border-[#3B82F6]/20 transition-colors duration-300">
              <span className="text-2xl mb-3 block">{p.icon}</span>
              <h3 className="text-sm font-bold mb-2">{p.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== VISUAL REFERENCES ===== */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-[#EF4444] mb-2 font-medium">05</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Referências Visuais</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            { name: 'Linear', what: 'Navegação limpa, dark mode premium, micro-interações sutis', applies: 'Sidebar, transições, atalhos de teclado' },
            { name: 'Stripe', what: 'Documentação visual, hierarquia de dados, design system maduro', applies: 'Cards financeiros, tabelas, design tokens' },
            { name: 'Vercel', what: 'Minimalismo extremo, tipografia forte, espaço negativo', applies: 'Login, hero, onboarding, landing page' },
            { name: 'ClickUp', what: 'Densidade informacional, filtros poderosos, produtividade', applies: 'PDV, estoque, relatórios, dashboards' },
          ].map((r) => (
            <div key={r.name} className="bg-[#111827]/40 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-1 bg-gradient-to-r from-[#3B82F6] to-[#7C3AED] bg-clip-text text-transparent">{r.name}</h3>
              <p className="text-xs text-white/50 mb-3">{r.what}</p>
              <p className="text-[10px] text-white/25">Aplica-se a: {r.applies}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-[#3B82F6] to-[#7C3AED] bg-clip-text text-transparent">PUSHY ERP</h3>
            <p className="text-xs text-white/30 mt-1">{BRAND.tagline}</p>
          </div>
          <p className="text-[10px] text-white/15">Brand Identity & Design System — Visual Exploration</p>
        </div>
      </footer>

      {/* ===== LIGHTBOX ===== */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <div className="relative w-full max-w-5xl max-h-[90vh]">
            <Image
              src={BRAND.images[lightbox].src}
              alt={BRAND.images[lightbox].title}
              width={2752}
              height={1536}
              className="w-full h-auto rounded-xl object-contain max-h-[85vh]"
              unoptimized
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl p-6">
              <h3 className="text-sm font-semibold">{BRAND.images[lightbox].title}</h3>
              <p className="text-xs text-white/50 mt-1">{BRAND.images[lightbox].desc}</p>
            </div>
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
