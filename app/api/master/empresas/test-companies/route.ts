export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getProtectionMap } from '@/lib/company-deletion';

/** Padrões de nome considerados "de teste". */
const TEST_PATTERNS = ['TEST', 'TESTE', 'HOMOLOG', 'SANDBOX', 'DEMO'];

/**
 * GET /api/master/empresas/test-companies
 *
 * Detecta empresas candidatas à limpeza rápida ("Remover empresas de teste").
 * Critérios (qualquer um):
 *   1) Nome contém TEST | TESTE | HOMOLOG | SANDBOX | DEMO
 *   2) Faturamento = 0 E nenhuma venda concluída
 *
 * Empresas protegidas (produção / conta master) são SEMPRE excluídas do resultado.
 * Retorna apenas a PRÉVIA — nunca executa exclusão.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        createdAt: true,
        isProtected: true,
        _count: { select: { users: true, sales: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const protection = await getProtectionMap(companies.map((c) => c.id));

    const matches: any[] = [];
    for (const c of companies) {
      if (protection[c.id]?.protected) continue; // nunca incluir protegidas

      const upperName = (c.name || '').toUpperCase();
      const matchedByName = TEST_PATTERNS.some((p) => upperName.includes(p));

      let matchedByZero = false;
      let reason = '';
      if (matchedByName) {
        reason = 'Nome de teste/homologação';
      } else if (c._count.sales === 0) {
        // sem vendas — conferir faturamento (deve ser 0)
        const agg = await prisma.sale.aggregate({
          where: { companyId: c.id, status: 'concluida' },
          _sum: { total: true },
        });
        const revenue = agg._sum?.total ?? 0;
        if (revenue === 0) {
          matchedByZero = true;
          reason = 'Sem vendas e faturamento zero';
        }
      }

      if (matchedByName || matchedByZero) {
        matches.push({
          id: c.id,
          name: c.name,
          plan: c.plan,
          createdAt: c.createdAt,
          users: c._count.users,
          sales: c._count.sales,
          reason,
        });
      }
    }

    return NextResponse.json({
      count: matches.length,
      patterns: TEST_PATTERNS,
      companies: matches,
    });
  } catch (error: any) {
    console.error('Detect test companies error:', error);
    return NextResponse.json(
      { error: 'Erro ao detectar empresas de teste: ' + (error?.message || 'Erro desconhecido') },
      { status: 500 }
    );
  }
}
