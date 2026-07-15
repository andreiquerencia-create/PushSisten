/**
 * syncOverdueInstallments(companyId)
 *
 * Função central e idempotente que:
 * 1. Persiste status OVERDUE em parcelas vencidas (PENDING/PARTIAL com dueDate < agora)
 * 2. Bloqueia automaticamente CustomerCredit de clientes com parcelas OVERDUE
 *    (marcando blockReason = 'AUTO_OVERDUE')
 * 3. Desbloqueia automaticamente CustomerCredit de clientes que regularizaram
 *    a situação (sem parcelas OVERDUE) — EXCETO bloqueios manuais (blockReason = 'MANUAL')
 *
 * Pode ser chamada múltiplas vezes sem efeitos duplicados.
 * Não altera parcelas PAID, CANCELLED ou futuras.
 */

import { prisma } from '@/lib/db'

export interface SyncResult {
  installmentsMarkedOverdue: number
  customersBlocked: number
  customersUnblocked: number
}

export async function syncOverdueInstallments(companyId: string): Promise<SyncResult> {
  const now = new Date()

  // 1. Marcar parcelas vencidas como OVERDUE
  //    Idempotente: só atualiza PENDING/PARTIAL com dueDate passada
  const overdueResult = await prisma.installment.updateMany({
    where: {
      companyId,
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { lt: now },
    },
    data: {
      status: 'OVERDUE',
    },
  })

  // 2. Identificar clientes distintos COM parcelas OVERDUE (inadimplentes)
  const overdueCustomers = await prisma.installment.findMany({
    where: {
      companyId,
      status: 'OVERDUE',
    },
    select: { customerId: true },
    distinct: ['customerId'],
  })
  const overdueCustomerIds = overdueCustomers.map(c => c.customerId)

  let customersBlocked = 0
  let customersUnblocked = 0

  // 3. Bloquear crédito de clientes inadimplentes (apenas ACTIVE → BLOCKED)
  //    Idempotente: não toca em créditos já BLOCKED. Marca origem do bloqueio.
  if (overdueCustomerIds.length > 0) {
    const blockResult = await prisma.customerCredit.updateMany({
      where: {
        companyId,
        customerId: { in: overdueCustomerIds },
        status: 'ACTIVE',
      },
      data: {
        status: 'BLOCKED',
        blockReason: 'AUTO_OVERDUE',
      },
    })
    customersBlocked = blockResult.count
  }

  // 4. Desbloquear automaticamente clientes que regularizaram
  //    Regra de segurança:
  //      - status atual = BLOCKED
  //      - blockReason ≠ 'MANUAL' (não desbloqueia bloqueios manuais)
  //      - cliente NÃO está na lista de inadimplentes (sem parcelas OVERDUE)
  //    Idempotente: só atua sobre BLOCKED elegíveis.
  const unblockResult = await prisma.customerCredit.updateMany({
    where: {
      companyId,
      status: 'BLOCKED',
      blockReason: { not: 'MANUAL' },
      ...(overdueCustomerIds.length > 0
        ? { customerId: { notIn: overdueCustomerIds } }
        : {}),
    },
    data: {
      status: 'ACTIVE',
      blockReason: null,
    },
  })
  customersUnblocked = unblockResult.count

  // 5. Registrar no ActivityLog (apenas se houve alterações relevantes)
  if (overdueResult.count > 0 || customersBlocked > 0 || customersUnblocked > 0) {
    await prisma.activityLog.create({
      data: {
        action: 'crediario_sync_overdue',
        description: `Sincronização crediário: ${overdueResult.count} parcela(s) marcada(s) como OVERDUE, ${customersBlocked} cliente(s) bloqueado(s), ${customersUnblocked} cliente(s) desbloqueado(s)`,
        entityType: 'customerCredit',
        metadata: {
          installmentsMarkedOverdue: overdueResult.count,
          customersBlocked,
          customersUnblocked,
          syncDate: now.toISOString(),
        },
        companyId,
      },
    })
  }

  return {
    installmentsMarkedOverdue: overdueResult.count,
    customersBlocked,
    customersUnblocked,
  }
}

/**
 * syncCreditStatus(companyId) — alias semântico de syncOverdueInstallments.
 * Mantido para clareza nos pontos onde o foco é o (des)bloqueio de crédito
 * (ex.: após recebimento ou renegociação).
 */
export async function syncCreditStatus(companyId: string): Promise<SyncResult> {
  return syncOverdueInstallments(companyId)
}
