import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { renegotiateInstallments, RenegotiationError } from '@/lib/crediario-renegotiation'
import { syncCreditStatus } from '@/lib/crediario-sync'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Apenas admin, socio e gerente podem renegociar
  const allowedRoles = ['administrador', 'socio', 'gerente']
  if (!allowedRoles.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Sem permissão para renegociar crediário' }, { status: 403 })
  }

  const companyId = session.user.companyId
  const userId = session.user.id

  try {
    const body = await req.json()
    const {
      customerId,
      installmentIds,
      entryAmount = 0,
      newInstallments,
      firstDueDate,
      termDays = 30,
      cashAccountId,
      notes,
    } = body

    // Validações básicas do body
    if (!customerId) {
      return NextResponse.json({ error: 'customerId é obrigatório' }, { status: 400 })
    }
    if (!installmentIds?.length) {
      return NextResponse.json({ error: 'installmentIds é obrigatório (array com ao menos 1 ID)' }, { status: 400 })
    }
    if (!newInstallments || newInstallments < 1) {
      return NextResponse.json({ error: 'newInstallments deve ser >= 1' }, { status: 400 })
    }
    if (!firstDueDate) {
      return NextResponse.json({ error: 'firstDueDate é obrigatório (YYYY-MM-DD)' }, { status: 400 })
    }

    const result = await renegotiateInstallments({
      companyId,
      customerId,
      installmentIds,
      entryAmount: Number(entryAmount) || 0,
      newInstallments: Number(newInstallments),
      firstDueDate,
      termDays: Number(termDays) || 30,
      cashAccountId,
      userId,
      notes,
    })

    // Após renegociar, sincroniza status de crédito (pode desbloquear se regularizou)
    try {
      await syncCreditStatus(companyId)
    } catch (e) {
      console.error('[CREDIARIO] Erro ao sincronizar status pós-renegociação:', e)
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof RenegotiationError) {
      const statusMap: Record<string, number> = {
        MISSING_INSTALLMENTS: 400,
        INVALID_NEW_COUNT: 400,
        INVALID_ENTRY: 400,
        MISSING_CASH_ACCOUNT: 400,
        INSTALLMENT_NOT_FOUND: 404,
        CUSTOMER_MISMATCH: 400,
        SALE_MISMATCH: 400,
        INVALID_STATUS: 400,
        ALREADY_RENEGOTIATED: 400,
        ENTRY_EXCEEDS_BALANCE: 400,
        CASH_ACCOUNT_NOT_FOUND: 404,
      }
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: statusMap[err.code] || 400 }
      )
    }
    console.error('[RENEGOCIACAO] Erro:', err)
    return NextResponse.json({ error: 'Erro interno ao processar renegociação' }, { status: 500 })
  }
}
