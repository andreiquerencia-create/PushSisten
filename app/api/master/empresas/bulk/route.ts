export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  deleteCompanyCascade,
  getProtectionMap,
  getCompanyRecordCounts,
} from '@/lib/company-deletion';

/**
 * Endpoint de operações em MASSA sobre empresas (Painel Master).
 *
 * POST body:
 *  { action: 'preview', ids: string[] }
 *      → retorna contagem agregada (empresas, usuários, registros) e
 *        a lista de empresas protegidas (que serão ignoradas na exclusão).
 *
 *  { action: 'delete', ids: string[], confirmText: 'EXCLUIR' }
 *      → exclui cada empresa em sua própria transação (rollback automático
 *        por empresa em caso de erro). Empresas protegidas são puladas.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const action: string = body?.action;
    const ids: string[] = Array.isArray(body?.ids)
      ? Array.from(new Set(body.ids.filter((x: any) => typeof x === 'string' && x)))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenhuma empresa selecionada' }, { status: 400 });
    }

    // Buscar empresas reais + mapa de proteção
    const [companies, protection] = await Promise.all([
      prisma.company.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, isProtected: true },
      }),
      getProtectionMap(ids),
    ]);

    const protectedCompanies = companies.filter((c) => protection[c.id]?.protected);
    const deletableCompanies = companies.filter((c) => !protection[c.id]?.protected);

    /* ─────────── PREVIEW ─────────── */
    if (action === 'preview') {
      let users = 0;
      let totalRecords = 0;
      const deletableDetailed: { id: string; name: string; users: number; totalRecords: number }[] = [];
      for (const c of deletableCompanies) {
        const counts = await getCompanyRecordCounts(c.id);
        users += counts.users;
        totalRecords += counts.total;
        deletableDetailed.push({ id: c.id, name: c.name, users: counts.users, totalRecords: counts.total });
      }
      return NextResponse.json({
        companies: deletableCompanies.length,
        users,
        totalRecords,
        deletable: deletableDetailed,
        protected: protectedCompanies.map((c) => ({
          id: c.id,
          name: c.name,
          reasons: protection[c.id]?.reasons || [],
        })),
      });
    }

    /* ─────────── DELETE ─────────── */
    if (action === 'delete') {
      if (body?.confirmText !== 'EXCLUIR') {
        return NextResponse.json(
          { error: 'Confirmação inválida. Digite EXCLUIR para confirmar.' },
          { status: 400 }
        );
      }
      if (deletableCompanies.length === 0) {
        return NextResponse.json(
          { error: 'Nenhuma empresa elegível para exclusão (todas protegidas).' },
          { status: 400 }
        );
      }

      const deleted: { id: string; name: string; records: number }[] = [];
      const failed: { id: string; name: string; error: string }[] = [];

      // Cada empresa em sua própria transação → falha isolada, rollback por empresa
      for (const c of deletableCompanies) {
        let counts: any = null;
        try {
          try { counts = await getCompanyRecordCounts(c.id); } catch { /* não crítico */ }
          await prisma.$transaction(
            async (tx: any) => { await deleteCompanyCascade(tx, c.id); },
            { timeout: 120000, maxWait: 20000 }
          );
          deleted.push({ id: c.id, name: c.name, records: counts?.total ?? 0 });
        } catch (e: any) {
          console.error(`Bulk delete failed for company ${c.id} (${c.name}):`, e);
          failed.push({ id: c.id, name: c.name, error: e?.message || 'Erro desconhecido' });
        }
      }

      // Log de auditoria (global — quem, quando, quantas, quais IDs)
      try {
        const totalRecords = deleted.reduce((s, d) => s + (d.records || 0), 0);
        await prisma.activityLog.create({
          data: {
            action: 'company_bulk_delete',
            description: `Exclusão em massa: ${deleted.length} empresa(s) removida(s)${failed.length ? `, ${failed.length} falha(s)` : ''} (${totalRecords} registros)`,
            entityType: 'company',
            entityId: deleted.map((d) => d.id).join(',').slice(0, 191) || 'bulk',
            userId: session.user.id,
            userName: session.user.name || 'Master',
            metadata: {
              deletedIds: deleted.map((d) => d.id),
              deletedNames: deleted.map((d) => d.name),
              failed,
              skippedProtected: protectedCompanies.map((c) => c.id),
              totalRecords,
              requestedCount: ids.length,
            },
          },
        });
      } catch (e) { console.error('Audit log (bulk delete) failed:', e); }

      return NextResponse.json({
        success: failed.length === 0,
        deletedCount: deleted.length,
        failedCount: failed.length,
        skippedProtectedCount: protectedCompanies.length,
        deleted,
        failed,
        skippedProtected: protectedCompanies.map((c) => ({ id: c.id, name: c.name })),
        message: `${deleted.length} empresa(s) excluída(s) com sucesso${failed.length ? `, ${failed.length} com falha` : ''}${protectedCompanies.length ? `, ${protectedCompanies.length} protegida(s) ignorada(s)` : ''}.`,
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('Bulk companies error:', error);
    return NextResponse.json(
      { error: 'Erro na operação em massa: ' + (error?.message || 'Erro desconhecido') },
      { status: 500 }
    );
  }
}
