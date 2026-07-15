export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { runAudit } from '@/lib/audit-engine';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'master') {
      return NextResponse.json({ error: 'Acesso restrito ao administrador' }, { status: 403 });
    }

    const companyId = (session.user as any).companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const report = await runAudit(companyId);
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Audit error:', error);
    return NextResponse.json({ error: 'Erro ao gerar auditoria', detail: error?.message }, { status: 500 });
  }
}
