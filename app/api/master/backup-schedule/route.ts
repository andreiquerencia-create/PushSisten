export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getSchedule } from '@/lib/backup-worker';

async function requireMaster() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Não autorizado', status: 401 as const };
  if (!(session.user as any).isMaster) return { error: 'Apenas master', status: 403 as const };
  return { session };
}

// GET -> configuração atual (cria singleton se ausente)
export async function GET() {
  const auth = await requireMaster();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const schedule = await getSchedule();
  return NextResponse.json({ schedule });
}

// PUT -> atualiza política de agendamento/retenção
export async function PUT(request: NextRequest) {
  const auth = await requireMaster();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const data: any = {};

  if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
  if (Number.isInteger(body.hourBrt) && body.hourBrt >= 0 && body.hourBrt <= 23) data.hourBrt = body.hourBrt;
  if (Number.isInteger(body.retentionDaily) && body.retentionDaily >= 1 && body.retentionDaily <= 60) data.retentionDaily = body.retentionDaily;
  if (Number.isInteger(body.retentionWeekly) && body.retentionWeekly >= 0 && body.retentionWeekly <= 26) data.retentionWeekly = body.retentionWeekly;
  if (Number.isInteger(body.retentionMonthly) && body.retentionMonthly >= 0 && body.retentionMonthly <= 36) data.retentionMonthly = body.retentionMonthly;

  await getSchedule(); // garante existência
  const schedule = await prisma.backupSchedule.update({ where: { id: 'global' }, data });

  const session = (auth as any).session;
  await prisma.activityLog.create({
    data: {
      action: 'company_edit',
      description: `Configuração de backup automático atualizada (diários ${schedule.retentionDaily}, semanais ${schedule.retentionWeekly}, mensais ${schedule.retentionMonthly}, ${schedule.enabled ? 'ativo' : 'inativo'}).`,
      entityType: 'backup',
      userId: (session.user as any).id ?? null,
      userName: session.user.name ?? null,
      metadata: { schedule },
    },
  });

  return NextResponse.json({ schedule });
}
