export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getAccountBalances, getLedgerEntries, getLedgerSummary, type LedgerSourceType } from '@/lib/ledger-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);

    const mode = url.searchParams.get('mode') ?? 'entries'; // entries | balances | summary
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const accountPlanId = url.searchParams.get('accountPlanId') ?? undefined;
    const sourceType = (url.searchParams.get('sourceType') ?? undefined) as LedgerSourceType | undefined;
    const sourceId = url.searchParams.get('sourceId') ?? undefined;
    const limit = parseInt(url.searchParams.get('limit') ?? '100');
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    const sd = startDate ? new Date(startDate) : undefined;
    const ed = endDate ? new Date(endDate) : undefined;

    if (mode === 'balances') {
      const balances = await getAccountBalances({ companyId, startDate: sd, endDate: ed });
      return NextResponse.json({ balances });
    }

    if (mode === 'summary') {
      const summary = await getLedgerSummary(companyId);
      return NextResponse.json(summary);
    }

    // Default: entries
    const result = await getLedgerEntries({
      companyId,
      startDate: sd,
      endDate: ed,
      accountPlanId,
      sourceType,
      sourceId,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET /api/ledger error:', error);
    return NextResponse.json({ error: 'Erro ao consultar ledger' }, { status: 500 });
  }
}
