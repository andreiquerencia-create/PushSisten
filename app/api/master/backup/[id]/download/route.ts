export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

// GET /api/master/backup/[id]/download -> URL assinada (S3) para download do JSON
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(session.user as any).isMaster) return NextResponse.json({ error: 'Apenas master' }, { status: 403 });

  const backup = await prisma.backupRecord.findUnique({ where: { id: params.id } });
  if (!backup) return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
  if (backup.status !== 'completed' || !backup.cloudStoragePath) {
    return NextResponse.json({ error: 'Backup indisponível para download' }, { status: 409 });
  }

  const url = await getFileUrl(backup.cloudStoragePath, false);

  await prisma.activityLog.create({
    data: {
      action: 'backup_download',
      description: `Download do backup da empresa ${backup.companyName}`,
      entityType: 'company',
      entityId: backup.companyId,
      companyId: backup.companyId,
      userId: (session.user as any).id ?? null,
      userName: session.user.name ?? null,
      metadata: { backupId: backup.id },
    },
  });

  return NextResponse.json({ url, fileName: `backup-${backup.companyName}-${backup.id}.json` });
}
