export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { calculateDRE } from '@/lib/financial-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    // ===== FONTE ÚNICA: financial-engine =====
    const dre = await calculateDRE(
      companyId,
      hasDateFilter ? dateFilter : undefined
    );

    return NextResponse.json(dre);
  } catch (error) {
    console.error('GET /api/dre error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
