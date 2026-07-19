import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Routes blocked for vendedor role
const VENDEDOR_BLOCKED = [
  '/dashboard',
  '/financeiro',
  '/caixas',
  '/formas-pagamento',
  '/contas',
  '/fluxo-caixa',
  '/dre',
  '/executivo',
  '/ia-gerente',
  '/alertas-ia',
  '/automacoes',
  '/whatsapp-ia',
  '/usuarios',
  '/fornecedores',
  '/transportadoras',
  '/estatisticas',
  '/relatorios',
  '/configuracoes',
  '/estoque',
  '/importacao',
  '/plano-contas',
  '/produtos',
  '/vendedores',
  '/categorias',
];

// Operational routes that master should NOT access (master is SaaS admin, not a store operator)
const OPERATIONAL_ROUTES = [
  '/dashboard',
  '/pdv',
  '/vendas',
  '/produtos',
  '/categorias',
  '/clientes',
  '/vendedores',
  '/estoque',
  '/financeiro',
  '/caixas',
  '/formas-pagamento',
  '/contas',
  '/fluxo-caixa',
  '/dre',
  '/executivo',
  '/ia-gerente',
  '/alertas-ia',
  '/automacoes',
  '/whatsapp-ia',
  '/usuarios',
  '/fornecedores',
  '/transportadoras',
  '/estatisticas',
  '/relatorios',
  '/meu-painel',
  '/configuracoes',
  '/importacao',
  '/plano-contas',
  '/hoje',
  '/push-score',
  '/crediario',
  '/auditoria',
  '/sem-classificacao',
  '/relatorios-inteligentes',
];

// Routes that DON'T require subscription/trial check (TAREFA 7 — exceções)
const SUBSCRIPTION_EXEMPT = [
  '/assinatura-expirada',
  '/trial-expirado',
  '/planos',
  '/master',
  '/login',
  '/signup',
  '/setup',
];

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token;

    // Block non-master users from /master
    if (pathname.startsWith('/master') && !token?.isMaster) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Master user trying to access operational routes → redirect to /master
    if (token.isMaster) {
      const isOperational = OPERATIONAL_ROUTES.some(route => pathname.startsWith(route));
      if (isOperational) {
        return NextResponse.redirect(new URL('/master', req.url));
      }
    }

    // ─── SUBSCRIPTION / TRIAL CHECK ───
    // Only for non-master users on non-exempt routes
    if (!token.isMaster) {
      const isExempt = SUBSCRIPTION_EXEMPT.some(route => pathname.startsWith(route));
      if (!isExempt && token.companyId) {
        try {
          const checkUrl = new URL('/api/subscription-check', req.url);
          checkUrl.searchParams.set('companyId', token.companyId as string);
          const checkRes = await fetch(checkUrl.toString(), {
            headers: { 'x-middleware-check': '1' },
          });
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.blocked) {
              return NextResponse.redirect(new URL('/assinatura-expirada', req.url));
            }
          }
        } catch {
          // If check fails, allow access (fail-open)
        }
      }
    }

    // Block vendedor from restricted routes → redirect to /meu-painel
    if (token.role === 'vendedor') {
      const isBlocked = VENDEDOR_BLOCKED.some(route => pathname.startsWith(route));
      if (isBlocked) {
        return NextResponse.redirect(new URL('/meu-painel', req.url));
      }
    }

    // Gerente blocked from critical admin-only routes
    if (token.role === 'gerente') {
      const gerenteBlocked = ['/plano-contas', '/automacoes', '/whatsapp-ia'];
      const isBlocked = gerenteBlocked.some(route => pathname.startsWith(route));
      if (isBlocked) {
        return NextResponse.redirect(new URL('/hoje', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (
          pathname === '/login' ||
          pathname === '/signup' ||
          pathname === '/' ||
          pathname.startsWith('/api/')
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/produtos/:path*',
    '/categorias/:path*',
    '/clientes/:path*',
    '/vendas/:path*',
    '/estoque/:path*',
    '/financeiro/:path*',
    '/contas/:path*',
    '/fluxo-caixa/:path*',
    '/dre/:path*',
    '/ia-gerente/:path*',
    '/alertas-ia/:path*',
    '/automacoes/:path*',
    '/whatsapp-ia/:path*',
    '/executivo/:path*',
    '/usuarios/:path*',
    '/master/:path*',
    '/pdv/:path*',
    '/vendedores/:path*',
    '/fornecedores/:path*',
    '/transportadoras/:path*',
    '/estatisticas/:path*',
    '/relatorios/:path*',
    '/meu-painel/:path*',
    '/configuracoes/:path*',
    '/importacao/:path*',
    '/caixas/:path*',
    '/formas-pagamento/:path*',
    '/plano-contas/:path*',
    '/assinatura-expirada/:path*',
    '/trial-expirado/:path*',
    '/planos/:path*',
    '/hoje/:path*',
    '/push-score/:path*',
    '/crediario/:path*',
    '/auditoria/:path*',
    '/sem-classificacao/:path*',
    '/relatorios-inteligentes/:path*',
    '/setup/:path*',
  ],
};
