export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // ── Growth: companies created per month (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const companiesRaw = await prisma.company.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by month
    const growthMap: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      growthMap[key] = 0;
    }
    for (const c of companiesRaw) {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (growthMap[key] !== undefined) growthMap[key]++;
    }
    const growth = Object.entries(growthMap).map(([month, count]) => ({ month, count }));

    // ── Revenue per month (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const salesRaw = await prisma.sale.findMany({
      where: { createdAt: { gte: sixMonthsAgo }, status: 'concluida' },
      select: { createdAt: true, total: true },
    });
    const revenueMap: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueMap[key] = 0;
    }
    for (const s of salesRaw) {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (revenueMap[key] !== undefined) revenueMap[key] += (s.total ?? 0);
    }
    const revenue = Object.entries(revenueMap).map(([month, total]) => ({ month, total }));

    // ── Integration checklist per company
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        whatsapp: true,
        logoUrl: true,
        _count: {
          select: {
            products: true,
            customers: true,
            sales: true,
            sellers: true,
            categories: true,
            financialCategories: true,
            cashAccounts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const checklists = companies.map((c: any) => {
      const items = [
        { key: 'cnpj', label: 'CNPJ cadastrado', done: !!c.cnpj },
        { key: 'whatsapp', label: 'WhatsApp configurado', done: !!c.whatsapp },
        { key: 'logo', label: 'Logo da empresa', done: !!c.logoUrl },
        { key: 'categories', label: 'Categorias criadas', done: (c._count?.categories ?? 0) > 0 },
        { key: 'products', label: 'Produtos cadastrados', done: (c._count?.products ?? 0) > 0 },
        { key: 'customers', label: 'Clientes cadastrados', done: (c._count?.customers ?? 0) > 0 },
        { key: 'sellers', label: 'Vendedores configurados', done: (c._count?.sellers ?? 0) > 0 },
        { key: 'cashAccounts', label: 'Caixa configurado', done: (c._count?.cashAccounts ?? 0) > 0 },
        { key: 'sales', label: 'Primeira venda realizada', done: (c._count?.sales ?? 0) > 0 },
      ];
      const completed = items.filter(i => i.done).length;
      return { id: c.id, name: c.name, items, completed, total: items.length, pct: Math.round((completed / items.length) * 100) };
    });

    // ── Activity logs (last 100)
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        description: true,
        entityType: true,
        userName: true,
        companyId: true,
        createdAt: true,
        metadata: true,
        company: { select: { name: true } },
      },
    });

    return NextResponse.json({ growth, revenue, checklists, logs });
  } catch (error: any) {
    console.error('Master analytics error:', error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
