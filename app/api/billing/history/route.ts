export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getBillingOverview } from '@/lib/billing-engine';

/** GET /api/billing/history — visão de cobrança + histórico da empresa logada. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId as string | undefined;
    if ((session.user as any).isMaster || !companyId) {
      return NextResponse.json({ isMaster: true });
    }
    const overview = await getBillingOverview(companyId);
    return NextResponse.json(overview);
  } catch (e: any) {
    console.error('billing/history error:', e?.message);
    return NextResponse.json({ error: 'Erro ao carregar histórico.' }, { status: 500 });
  }
}
