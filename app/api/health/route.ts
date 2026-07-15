export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/health
 * 
 * Endpoint público de health check para monitoring externo (UptimeRobot, etc).
 * Verifica:
 * 1. Conexão com o banco de dados
 * 2. Tempo de resposta do banco
 * 3. Contagem básica de empresas ativas
 *
 * Retorna 200 se tudo OK, 503 se o banco está fora.
 */
export async function GET(_req: NextRequest) {
  const start = Date.now();
  try {
    // 1) DB ping
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    // 2) Contagem básica (prova que o schema está acessível)
    const companyCount = await prisma.company.count({ where: { isActive: true } });

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: {
        connected: true,
        latencyMs: dbLatency,
      },
      companies: companyCount,
      uptime: process.uptime(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      db: {
        connected: false,
        error: error?.message?.substring(0, 200) ?? 'Desconhecido',
      },
    }, { status: 503 });
  }
}
