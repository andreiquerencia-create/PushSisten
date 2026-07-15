export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const existing = await prisma.accountPlan.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    const body = await req.json();

    // System accounts: allow updating only name, sortOrder and isActive.
    // Block changes to code, type, parentId, dreGroup, showInDre to preserve
    // hardcoded references used by the application (1.01, 2.01, 2.05, 5.01, etc).
    const isSystem = existing.isSystem === true;

    const data: any = {
      name: body.name ?? existing.name,
      sortOrder: body.sortOrder ?? existing.sortOrder,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    };

    if (!isSystem) {
      data.code = body.code ?? existing.code;
      data.type = body.type ?? existing.type;
      data.dreGroup = body.dreGroup !== undefined ? body.dreGroup : existing.dreGroup;
      data.showInDre = body.showInDre !== undefined ? body.showInDre : existing.showInDre;
      data.parentId = body.parentId !== undefined ? body.parentId : existing.parentId;
    }

    const plan = await prisma.accountPlan.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('Erro ao atualizar plano de contas:', error);
    return NextResponse.json({ error: 'Erro ao atualizar conta' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const existing = await prisma.accountPlan.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    // System accounts cannot be deleted - they may be referenced in code.
    // Users can deactivate them via PUT { isActive: false } if needed.
    if (existing.isSystem === true) {
      return NextResponse.json({
        error: 'Esta conta faz parte do plano padrão do sistema e não pode ser excluída. Você pode desativá-la se não estiver em uso.',
      }, { status: 403 });
    }

    // Check if has records
    const recordCount = await prisma.financialRecord.count({ where: { accountPlanId: params.id } });
    if (recordCount > 0) {
      // Soft delete - just deactivate
      await prisma.accountPlan.update({ where: { id: params.id }, data: { isActive: false } });
      return NextResponse.json({ message: 'Conta desativada (possui lançamentos vinculados)' });
    }

    // Hard delete if no records
    await prisma.accountPlan.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Conta excluída' });
  } catch (error: any) {
    console.error('Erro ao excluir plano de contas:', error);
    return NextResponse.json({ error: 'Erro ao excluir conta' }, { status: 500 });
  }
}
