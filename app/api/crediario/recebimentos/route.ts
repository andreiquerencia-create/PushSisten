import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { recordARReceipt } from '@/lib/ledger-engine'
import { syncCreditStatus } from '@/lib/crediario-sync'

// POST — receber parcela(s)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId

  const body = await req.json()
  const { installmentIds, amounts, cashAccountId, paymentMethodId, notes } = body
  // installmentIds: string[] — IDs das parcelas a receber
  // amounts: number[] — valores a pagar para cada parcela (permite parcial)
  // cashAccountId: string — conta caixa destino
  // paymentMethodId: string — forma de pagamento utilizada

  if (!installmentIds?.length || !amounts?.length || !cashAccountId) {
    return NextResponse.json({ error: 'installmentIds, amounts e cashAccountId são obrigatórios' }, { status: 400 })
  }

  if (installmentIds.length !== amounts.length) {
    return NextResponse.json({ error: 'installmentIds e amounts devem ter o mesmo tamanho' }, { status: 400 })
  }

  // Verificar caixa
  const cashAccount = await prisma.cashAccount.findFirst({ where: { id: cashAccountId, companyId, isActive: true } })
  if (!cashAccount) return NextResponse.json({ error: 'Conta caixa não encontrada' }, { status: 404 })

  // Buscar parcelas
  const installments = await prisma.installment.findMany({
    where: { id: { in: installmentIds }, companyId },
    include: { customer: true },
  })

  if (installments.length !== installmentIds.length) {
    return NextResponse.json({ error: 'Uma ou mais parcelas não encontradas' }, { status: 404 })
  }

  // Validar cada parcela
  for (let i = 0; i < installments.length; i++) {
    const inst = installments.find(x => x.id === installmentIds[i])!
    const payAmount = Number(amounts[i])
    const remaining = inst.amount - inst.paidAmount

    if (payAmount <= 0) {
      return NextResponse.json({ error: `Valor inválido para parcela ${inst.installmentNumber}` }, { status: 400 })
    }
    if (payAmount > remaining + 0.01) {
      return NextResponse.json(
        { error: `Valor excede saldo da parcela ${inst.installmentNumber} (restante: R$ ${remaining.toFixed(2)})` },
        { status: 400 }
      )
    }
    if (inst.status === 'PAID' || inst.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Parcela ${inst.installmentNumber} já está ${inst.status}` },
        { status: 400 }
      )
    }
  }

  // Executar tudo em transação
  const result = await prisma.$transaction(async (tx) => {
    let totalPaid = 0
    const updatedInstallments: any[] = []

    // Buscar nome da forma de pagamento (uma vez)
    const payMethodName = paymentMethodId
      ? (await tx.paymentMethod.findUnique({ where: { id: paymentMethodId }, select: { name: true } }))?.name ?? 'Pagamento'
      : 'Pagamento'

    for (let i = 0; i < installmentIds.length; i++) {
      const instId = installmentIds[i]
      const payAmount = Math.round(Number(amounts[i]) * 100) / 100
      const inst = installments.find(x => x.id === instId)!
      totalPaid += payAmount

      await tx.installmentPayment.create({
        data: {
          installmentId: instId,
          companyId,
          amount: payAmount,
          cashAccountId,
          notes: notes || null,
        },
      })

      // Atualizar parcela
      const newPaidAmount = Math.round((inst.paidAmount + payAmount) * 100) / 100
      const remaining = Math.round((inst.amount - newPaidAmount) * 100) / 100
      const newStatus = remaining <= 0.01 ? 'PAID' : 'PARTIAL'

      const updated = await tx.installment.update({
        where: { id: instId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      })
      updatedInstallments.push(updated)
    }

    // Atualizar saldo do caixa (atômico)
    await tx.cashAccount.update({
      where: { id: cashAccountId },
      data: { currentBalance: { increment: totalPaid } },
    })

    // Criar movimentação de caixa
    const updatedCash = await tx.cashAccount.findUnique({ where: { id: cashAccountId } })
    await tx.cashMovement.create({
      data: {
        cashAccountId,
        companyId,
        type: 'entrada',
        amount: totalPaid,
        origin: 'recebimento_crediario',
        description: `Recebimento crediário (${payMethodName}) — ${installmentIds.length} parcela(s)`,
        balanceBefore: (updatedCash?.currentBalance ?? 0) - totalPaid,
        balanceAfter: updatedCash?.currentBalance ?? 0,
      },
    })

    // Atualizar limite utilizado do cliente (reduzir) — protegido contra valor negativo
    const customerId = installments[0].customerId
    const creditToUpdate = await tx.customerCredit.findFirst({
      where: { customerId, companyId },
      select: { id: true, usedLimit: true },
    })
    if (creditToUpdate) {
      const newUsedLimit = Math.max(0, creditToUpdate.usedLimit - totalPaid)
      await tx.customerCredit.update({
        where: { id: creditToUpdate.id },
        data: { usedLimit: newUsedLimit },
      })
    }

    // Criar/atualizar conta a receber correspondente
    // Buscar AR associada a essa venda e baixar proporcional
    const saleIds = [...new Set(installments.map(i => i.saleId))]
    for (const saleId of saleIds) {
      const ar = await tx.accountReceivable.findFirst({
        where: { companyId, saleId, status: { in: ['pendente', 'parcial'] } },
      })

      if (ar) {
        // Buscar TODAS as parcelas da venda para calcular total pago acumulado
        const allSaleInstallments = await tx.installment.findMany({
          where: { saleId, companyId },
          select: { paidAmount: true, status: true },
        })
        const totalPaidAccumulated = allSaleInstallments.reduce(
          (sum, i) => sum + Number(i.paidAmount), 0
        )
        const allInstallmentsPaid = allSaleInstallments.every(i => i.status === 'PAID')

        const newArStatus = (allInstallmentsPaid || totalPaidAccumulated >= Number(ar.amount) - 0.01)
          ? 'recebido'
          : 'parcial'
        await tx.accountReceivable.update({
          where: { id: ar.id },
          data: {
            status: newArStatus,
            ...(newArStatus === 'recebido' ? { receivedDate: new Date() } : {}),
          },
        })
      }
    }

    return { totalPaid, updatedInstallments }
  }, { timeout: 15000 })

  // Ledger — D 7.1 Caixa, C 7.3 Contas a Receber (fora da transação, não-bloqueante)
  try {
    // Gerar ledger por venda
    const saleIds = [...new Set(installments.map(i => i.saleId))]
    for (const saleId of saleIds) {
      const saleAmount = installments
        .filter(i => i.saleId === saleId)
        .reduce((sum, inst) => {
          const idx = installmentIds.indexOf(inst.id)
          return sum + Number(amounts[idx])
        }, 0)

      // Buscar AR para sourceId
      const ar = await prisma.accountReceivable.findFirst({
        where: { companyId, saleId },
      })

      if (ar && saleAmount > 0) {
        await recordARReceipt({
          companyId,
          receivableId: ar.id,
          amount: saleAmount,
          receiptDate: new Date(),
        })
      }
    }
  } catch (err) {
    console.error('[LEDGER] Erro ao registrar recebimento crediário:', err)
  }

  // Sincroniza status de crédito: se o cliente regularizou (sem mais parcelas vencidas),
  // o desbloqueio automático acontece aqui imediatamente após o recebimento.
  try {
    await syncCreditStatus(companyId)
  } catch (err) {
    console.error('[CREDIARIO] Erro ao sincronizar status pós-recebimento:', err)
  }

  return NextResponse.json({
    success: true,
    totalPaid: result.totalPaid,
    installments: result.updatedInstallments,
  })
}
