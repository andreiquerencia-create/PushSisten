export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getObjectString } from '@/lib/s3';
import { validateBackup, restoreToNewCompany, BackupEnvelope } from '@/lib/restore-engine';

/**
 * POST /api/master/restore
 * Body: { backupId: string, mode: 'dry-run' | 'commit', newCompanyName?: string, confirm?: boolean }
 *
 * MODO ÚNICO: NOVA EMPRESA / SANDBOX (não destrutivo). Não existe in-place.
 * - 'dry-run'  -> valida JSON + integridade + relatório de impacto (NENHUMA gravação).
 * - 'commit'   -> exige dry-run válido + confirm:true + newCompanyName; restaura em
 *                 transação única (rollback automático) e roda validações pós-restauro.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(session.user as any).isMaster) return NextResponse.json({ error: 'Apenas master pode restaurar backups' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const backupId: string | undefined = body?.backupId;
  const mode: string = body?.mode === 'commit' ? 'commit' : 'dry-run';
  const newCompanyName: string | undefined = body?.newCompanyName?.trim();
  const confirm: boolean = body?.confirm === true;

  if (!backupId) return NextResponse.json({ error: 'backupId obrigatório' }, { status: 400 });

  const record = await prisma.backupRecord.findUnique({ where: { id: backupId } });
  if (!record) return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
  if (record.status !== 'completed' || !record.cloudStoragePath) {
    return NextResponse.json({ error: 'Backup indisponível (não concluído).' }, { status: 409 });
  }

  // ---- Baixa e parseia o JSON do S3 ----
  let envelope: BackupEnvelope;
  try {
    const text = await getObjectString(record.cloudStoragePath);
    envelope = JSON.parse(text);
  } catch (e: any) {
    return NextResponse.json({ error: 'Falha ao ler/parsear o backup do S3: ' + (e?.message || 'erro') }, { status: 500 });
  }

  // ---- 1+2+3. Validação + integridade + relatório de impacto (sempre) ----
  const report = validateBackup(envelope);

  if (mode === 'dry-run') {
    return NextResponse.json({ mode: 'dry-run', report });
  }

  // ---- A partir daqui: COMMIT (gravação) ----
  if (!report.valid) {
    return NextResponse.json({ error: 'Backup inválido. Restauração bloqueada.', report }, { status: 422 });
  }
  if (!confirm) {
    return NextResponse.json({ error: 'Confirmação explícita obrigatória (confirm:true).', report }, { status: 400 });
  }
  if (!newCompanyName) {
    return NextResponse.json({ error: 'newCompanyName obrigatório para criar a nova empresa.' }, { status: 400 });
  }

  try {
    const result = await restoreToNewCompany({ envelope, newCompanyName });

    const allOk = result.validations.every((v) => v.ok);

    // 6. Auditoria completa
    await prisma.activityLog.create({
      data: {
        action: 'backup_restore',
        description: `Restauração (NOVA EMPRESA) a partir do backup de "${record.companyName}" -> "${newCompanyName}": ${result.totalInserted} registros. Validações ${allOk ? 'OK' : 'COM ALERTAS'}.`,
        entityType: 'company',
        entityId: result.newCompanyId,
        companyId: result.newCompanyId,
        userId: (session.user as any).id ?? null,
        userName: session.user.name ?? null,
        metadata: {
          sourceBackupId: record.id,
          sourceCompanyId: record.companyId,
          totalInserted: result.totalInserted,
          emailRewrites: result.emailRewrites,
          orphanRefs: result.orphanRefs,
          durationMs: result.durationMs,
          validations: result.validations,
        } as any,
      },
    });

    return NextResponse.json({ mode: 'commit', report, result, validationsOk: allOk });
  } catch (error: any) {
    console.error('Erro na restauração (rollback aplicado):', error);
    // a transação já sofreu rollback automático; registra a falha
    await prisma.activityLog.create({
      data: {
        action: 'backup_restore_failed',
        description: `Falha na restauração do backup de "${record.companyName}" (rollback automático). Nenhum dado persistido.`,
        entityType: 'company',
        entityId: record.companyId,
        userId: (session.user as any).id ?? null,
        userName: session.user.name ?? null,
        metadata: { sourceBackupId: record.id, error: (error?.message || 'erro').slice(0, 500) },
      },
    }).catch(() => {});
    return NextResponse.json({ error: 'Falha na restauração (rollback aplicado, nada foi gravado): ' + (error?.message || 'erro') }, { status: 500 });
  }
}
