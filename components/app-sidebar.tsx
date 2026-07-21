'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  Users,
  ShoppingCart,
  Warehouse,
  DollarSign,
  Bot,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Monitor,
  Receipt,
  FileBarChart,
  Brain,
  Zap,
  Target,
  Wallet,
  Settings,
  Upload,
  HandCoins,
  HeartPulse,
  Sunrise,
  Rocket,
  Contact,
  Package,
  Truck,
  CreditCard,
  BookText,
  BarChart3,
  Tags,
  TrendingUp,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcademyHighlightActive } from '@/components/academy/academy-highlight';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles?: string[]; // if set, only these roles can see this item
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: string[]; // if set, only these roles can see this group
}

const allNavGroups: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { href: '/push-academy', label: 'Push Academy', icon: GraduationCap },
      { href: '/hoje', label: 'Hoje', icon: Sunrise, roles: ['administrador', 'socio', 'gerente'] },
      { href: '/meu-painel', label: 'Meu Painel', icon: Target, roles: ['vendedor'] },
      { href: '/pdv', label: 'PDV', icon: Monitor },
      { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/estoque', label: 'Estoque', icon: Warehouse, roles: ['administrador', 'socio', 'gerente'] },
      { href: '/produtos', label: 'Produtos', icon: Package, roles: ['administrador', 'socio', 'gerente'] },
      { href: '/categorias', label: 'Categorias', icon: Tags, roles: ['administrador', 'socio', 'gerente'] },
    ],
  },
  {
    label: 'Gestão',
    roles: ['administrador', 'socio', 'gerente'],
    items: [
      { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
      { href: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: TrendingUp },
      { href: '/crediario', label: 'Crediário', icon: HandCoins },
      { href: '/contas', label: 'Recebimentos e Pagamentos', icon: Receipt },
      { href: '/caixas', label: 'Caixas', icon: Wallet },
      { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
      { href: '/formas-pagamento', label: 'Formas de Pagamento', icon: CreditCard },
      { href: '/plano-contas', label: 'Plano de Contas', icon: BookText },
      { href: '/executivo', label: 'Visão Executiva', icon: Brain },
      { href: '/dre', label: 'Resultado (DRE)', icon: FileBarChart },
      { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
      { href: '/importacao', label: 'Importação de Dados', icon: Upload },
    ],
  },
  {
    label: 'Equipe',
    roles: ['administrador', 'socio', 'gerente'],
    items: [
      { href: '/usuarios', label: 'Usuários', icon: UserCog },
      { href: '/vendedores', label: 'Vendedores', icon: Contact },
    ],
  },
  {
    label: 'Inteligência',
    roles: ['administrador', 'socio', 'gerente'],
    items: [
      { href: '/ia-gerente', label: 'IA Gerente', icon: Bot },
      { href: '/push-score', label: 'Saúde da Loja', icon: HeartPulse },
      { href: '/relatorios-inteligentes', label: 'Relatórios Inteligentes', icon: Sparkles },
      { href: '/automacoes', label: 'Ações Automáticas', icon: Zap },
    ],
  },
];

const adminItems: NavItem[] = [
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

// Item comercial em destaque — visível para os lojistas (administrador/sócio/gerente)
// durante o período de teste, para que encontrem facilmente os planos e a assinatura.
const planosItem: NavItem = { href: '/planos', label: 'Planos e Assinatura', icon: Rocket };

export function AppSidebar() {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const academyHighlightActive = useAcademyHighlightActive();

  const role = session?.user?.role ?? '';
  const isAdmin = role === 'administrador' || role === 'socio' || role === 'gerente';
  const companyName = session?.user?.companyName ?? 'PushSisten';

  // Filter nav groups and items based on role
  const navGroups = useMemo(() => {
    return allNavGroups
      .filter(group => !group.roles || group.roles.includes(role))
      .map(group => ({
        ...group,
        items: group.items.filter(item => !item.roles || item.roles.includes(role)),
      }))
      .filter(group => group.items.length > 0);
  }, [role]);

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  const NavLink = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
    const isAcademyItem = item.href === '/push-academy';
    const shouldPulse = isAcademyItem && academyHighlightActive;

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
          shouldPulse && 'bg-primary/20 text-white ring-2 ring-primary/50 animate-pulse'
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-blue-400 to-violet-500" />
        )}
        <item.icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-blue-400' : shouldPulse ? 'text-primary' : 'text-slate-500 group-hover:text-slate-400')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo — PUSHY Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
          <span className="text-white font-display font-extrabold text-sm">P</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="font-display font-bold text-white text-sm tracking-tight truncate">
              PUSH<span className="text-blue-400">Y</span>
            </h2>
            <p className="text-[10px] text-slate-500 truncate font-medium tracking-wide">{companyName}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className={cn(
              'text-[10px] uppercase tracking-[0.08em] text-slate-600 font-semibold mb-1.5',
              collapsed ? 'text-center' : 'px-3'
            )}>
              {collapsed ? '·' : group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item: any) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith?.(item.href + '/'));
                return <NavLink key={item.href} item={item} isActive={isActive} />;
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div className="mb-3">
            <div className={cn('mb-1.5', !collapsed && 'px-3')}>
              <div className="border-t border-white/[0.04] mb-2" />
              <p className={cn('text-[10px] uppercase tracking-[0.08em] text-slate-600 font-semibold', collapsed && 'text-center')}>
                {collapsed ? '·' : 'Admin'}
              </p>
            </div>
            <div className="space-y-0.5">
              {adminItems.map((item: any) => {
                const isActive = pathname === item.href;
                return <NavLink key={item.href} item={item} isActive={isActive} />;
              })}

              {/* Planos e Assinatura — destaque comercial */}
              {(() => {
                const isActive = pathname === planosItem.href || pathname?.startsWith?.(planosItem.href + '/');
                return (
                  <Link
                    href={planosItem.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-200 ring-1 ring-amber-400/30'
                        : 'text-amber-300/90 hover:bg-amber-500/10 hover:text-amber-200 ring-1 ring-amber-400/20'
                    )}
                  >
                    <planosItem.icon className="w-4 h-4 flex-shrink-0 text-amber-400" />
                    {!collapsed && <span className="truncate">{planosItem.label}</span>}
                  </Link>
                );
              })()}
            </div>
          </div>
        )}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className={cn('flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg bg-white/[0.03]', collapsed && 'justify-center px-0')}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/20 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-400">
              {(session?.user?.name ?? 'U')?.[0]?.toUpperCase?.() ?? 'U'}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{session?.user?.name ?? 'Usuário'}</p>
              <p className="text-[10px] text-slate-500 capitalize truncate font-medium">{role || 'vendedor'}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-[13px]">Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-sidebar-bg text-white flex items-center justify-center shadow-lg shadow-black/20"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[270px] h-full bg-sidebar-bg shadow-2xl shadow-black/40">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen bg-sidebar-bg transition-all duration-300 flex-shrink-0 sticky top-0',
          collapsed ? 'w-[70px]' : 'w-[260px]'
        )}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-20 -right-3 w-6 h-6 rounded-full bg-sidebar-bg border border-border/50 text-slate-500 hover:text-white hover:border-blue-500/30 flex items-center justify-center text-xs z-10 transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
    </>
  );
}
