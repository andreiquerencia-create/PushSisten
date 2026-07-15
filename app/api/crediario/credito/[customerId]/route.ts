import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET — buscar crédito de um cliente específico
export async function GET(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId

  const credit = await prisma.customerCredit.findFirst({
    where: { customerId: params.customerId, companyId },
    include: {
      customer: { select: { id: true, name: true, cpfCnpj: true, phone: true } },
    },
  })

  if (!credit) return NextResponse.json({ error: 'Crédito não encontrado' }, { status: 404 })

  return NextResponse.json({ ...credit, availableLimit: credit.creditLimit - credit.usedLimit })
}

// PUT — atualizar crédito do cliente
export async function PUT(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId
  const role = session.user.role
  if (role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const { creditLimit, defaultTermDays, status, notes } = body

  const existing = await prisma.customerCredit.findFirst({
    where: { customerId: params.customerId, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Crédito não encontrado' }, { status: 404 })

  // Se estiver reduzindo limite abaixo do usado, bloquear
  if (creditLimit !== undefined && Number(creditLimit) < existing.usedLimit) {
    return NextResponse.json(
      { error: `Limite não pode ser menor que o utilizado (R$ ${existing.usedLimit.toFixed(2)})` },
      { status: 400 }
    )
  }

  // Quando o status é alterado manualmente, registramos a origem do bloqueio.
  // BLOCKED manual → blockReason = 'MANUAL' (não será desbloqueado automaticamente pelo sync)
  // ACTIVE manual  → blockReason = null (limpa qualquer marcação anterior)
  const blockReasonData =
    status !== undefined
      ? { blockReason: status === 'BLOCKED' ? 'MANUAL' : null }
      : {}

  const updated = await prisma.customerCredit.update({
    where: { id: existing.id },
    data: {
      ...(creditLimit !== undefined ? { creditLimit: Number(creditLimit) } : {}),
      ...(defaultTermDays !== undefined ? { defaultTermDays: Number(defaultTermDays) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...blockReasonData,
      ...(notes !== undefined ? { notes } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ ...updated, availableLimit: updated.creditLimit - updated.usedLimit })
}
