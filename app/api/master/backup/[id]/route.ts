export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/master/backup/[id] -> detalhes de um backup
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(session.user as any).isMaster) return NextResponse.json({ error: 'Apenas master' }, { status: 403 });

  const backup = await prisma.backupRecord.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
  return NextResponse.json({ backup });
}
