export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { suggestAccountPlanCode } from '@/lib/account-plan-classifier';

/**
 * POST /api/plano-contas/sugestao
 * 
 * Receives:
 *   - description (string, required)
 *   - direction ('entrada' | 'saida'), default: 'saida'
 * 
 * Returns:
 *   - suggestion: { accountPlanId, code, name, label, matchedKeyword } | null
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const companyId = session.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ suggestion: null });
    }
    const { description, direction } = body || {};

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ suggestion: null });
    }

    const ctx: 'entrada' | 'saida' = direction === 'entrada' ? 'entrada' : 'saida';
    const match = suggestAccountPlanCode(description, ctx);

    if (!match) {
      return NextResponse.json({ suggestion: null });
    }

    // Try exact code match in this company's AccountPlan
    let plan = await prisma.accountPlan.findFirst({
      where: {
        companyId,
        code: match.code,
        isActive: true,
      },
      select: { id: true, code: true, name: true, type: true },
    });

    // Fallback: try parent code (e.g., '3.3' if '3.3.1' not found)
    if (!plan) {
      const parts = match.code.split('.');
      if (parts.length > 1) {
        const parentCode = parts.slice(0, parts.length - 1).join('.');
        plan = await prisma.accountPlan.findFirst({
          where: { companyId, code: parentCode, isActive: true },
          select: { id: true, code: true, name: true, type: true },
        });
      }
    }

    if (!plan) {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({
      suggestion: {
        accountPlanId: plan.id,
        code: plan.code,
        name: plan.name,
        type: plan.type,
        label: match.label,
        matchedKeyword: match.matchedKeyword,
      },
    });
  } catch (error: any) {
    console.error('AccountPlan suggestion error:', error);
    return NextResponse.json({ error: 'Erro ao sugerir classificação', suggestion: null }, { status: 500 });
  }
}
