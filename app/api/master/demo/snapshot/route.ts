export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getDemoSnapshotStatus,
  createDemoSnapshot,
  resolveDemoCompany,
} from '@/lib/demo-snapshot-engine';

/** GET → status do snapshot oficial DEMO_V1 (metadados, sem payload). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const company = await resolveDemoCompany();
    const snapshot = await getDemoSnapshotStatus();
    return NextResponse.json({
      demoCompany: company,
      snapshot,
      hasSnapshot: !!snapshot,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao consultar snapshot.' }, { status: 500 });
  }
}

/** POST → cria o snapshot oficial DEMO_V1 (idempotente; force recaptura). */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;
    const result = await createDemoSnapshot({
      createdById: (session.user as any).id ?? null,
      createdByName: session.user.name ?? null,
      force,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao criar snapshot.' }, { status: 500 });
  }
}
