export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { reprocessGlobal } from '@/lib/reprocess-engine';

/**
 * POST /api/reprocessar
 * Reprocessamento global de campos desnormalizados (estatísticas de clientes).
 * Apenas administradores.
 */
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'administrador') {
      return NextResponse.json({ error: 'Apenas administradores podem reprocessar.' }, { status: 403 });
    }
    const companyId = (session.user as any).companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const result = await reprocessGlobal(companyId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Reprocess error:', error);
    return NextResponse.json({ error: 'Erro ao reprocessar', detail: error?.message }, { status: 500 });
  }
}
