import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

/**
 * GET /api/crediario/renegociacoes
 *
 * Histórico de renegociações do crediário.
 * Reconstrói cada acordo a partir do ActivityLog (action = 'crediario_renegotiation')
 * e enriquece com os dados das parcelas antigas/novas, cliente, venda e responsável.
 *
 * NÃO cria nenhuma entidade nova — usa apenas os campos já existentes:
 *   - ActivityLog (metadata do acordo + userId responsável)
 *   - Installment.renegotiationRef (parcelas novas)
 *   - Installment.replacedByRef   (parcelas originais substituídas)
 *
 * Filtros (query string):
 *   - customerId        → filtra por cliente
 *   - renegotiationRef  → filtra por referência do acordo
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const companyId = session.user.companyId

  const { searchParams } = new URL(req.url)
  const customerIdFilter = searchParams.get('customerId') || undefined
  const refFilter = searchParams.get('renegotiationRef') || undefined

  // 1. Buscar os acordos no ActivityLog
  const logs = await prisma.activityLog.findMany({
    where: {
      companyId,
      action: 'crediario_renegotiation',
      ...(refFilter ? { entityId: refFilter } : {}),
      ...(customerIdFilter
        ? { metadata: { path: ['customerId'], equals: customerIdFilter } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  if (logs.length === 0) {
    return NextResponse.json({ renegociacoes: [] })
  }

  // 2. Coletar referências, clientes, usuários e vendas para enriquecimento em lote
  const refs = logs.map(l => l.entityId).filter(Boolean) as string[]
  const userIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean))) as string[]
  const customerIds = Array.from(
    new Set(
      logs
        .map(l => (l.metadata as any)?.customerId)
        .filter(Boolean)
    )
  ) as string[]
  const saleIds = Array.from(
    new Set(
      logs
        .map(l => (l.metadata as any)?.saleId)
        .filter(Boolean)
    )
  ) as string[]

  const [users, customers, sales, oldInstallments, newInstallments] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, cpfCnpj: true, phone: true } }),
    prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, saleNumber: true, companySaleNumber: true, total: true, createdAt: true } }),
    // Parcelas originais (substituídas) — ligadas pelo replacedByRef
    prisma.installment.findMany({
      where: { companyId, replacedByRef: { in: refs } },
      select: { id: true, installmentNumber: true, amount: true, paidAmount: true, dueDate: true, status: true, replacedByRef: true, saleId: true },
      orderBy: { installmentNumber: 'asc' },
    }),
    // Parcelas novas geradas pelo acordo — ligadas pelo renegotiationRef
    prisma.installment.findMany({
      where: { companyId, renegotiationRef: { in: refs } },
      select: { id: true, installmentNumber: true, amount: true, paidAmount: true, dueDate: true, status: true, renegotiationRef: true, saleId: true },
      orderBy: { installmentNumber: 'asc' },
    }),
  ])

  const userMap = new Map(users.map(u => [u.id, u]))
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const saleMap = new Map(sales.map(s => [s.id, s]))

  const oldByRef = new Map<string, typeof oldInstallments>()
  for (const inst of oldInstallments) {
    const ref = inst.replacedByRef!
    if (!oldByRef.has(ref)) oldByRef.set(ref, [])
    oldByRef.get(ref)!.push(inst)
  }
  const newByRef = new Map<string, typeof newInstallments>()
  for (const inst of newInstallments) {
    const ref = inst.renegotiationRef!
    if (!newByRef.has(ref)) newByRef.set(ref, [])
    newByRef.get(ref)!.push(inst)
  }

  // 3. Montar resposta estruturada
  const renegociacoes = logs.map(log => {
    const meta = (log.metadata as any) || {}
    const ref = log.entityId as string
    const customer = meta.customerId ? customerMap.get(meta.customerId) : undefined
    const user = log.userId ? userMap.get(log.userId) : undefined
    const sale = meta.saleId ? saleMap.get(meta.saleId) : undefined
    const olds = oldByRef.get(ref) || []
    const news = newByRef.get(ref) || []

    const newDueDates = news
      .map(n => n.dueDate)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    return {
      renegotiationRef: ref,
      renegotiatedAt: log.createdAt,
      // Cliente
      customerId: meta.customerId ?? null,
      customerName: customer?.name ?? log.userName ?? 'Cliente',
      customerDoc: customer?.cpfCnpj ?? null,
      customerPhone: customer?.phone ?? null,
      // Venda original
      saleId: meta.saleId ?? null,
      saleNumber: sale?.saleNumber ?? null,
      companySaleNumber: sale?.companySaleNumber ?? null,
      saleTotal: sale?.total ?? null,
      saleDate: sale?.createdAt ?? null,
      // Valores do acordo
      originalTotal: meta.originalTotal ?? null,
      entryAmount: meta.entryAmount ?? 0,
      newBalance: meta.newBalance ?? null,
      newInstallmentsCount: meta.newInstallments ?? news.length,
      termDays: meta.termDays ?? null,
      firstDueDate: meta.firstDueDate ?? null,
      newDueDates,
      // Responsável
      userId: log.userId ?? null,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      // Detalhe das parcelas
      originalInstallments: olds.map(o => ({
        id: o.id,
        installmentNumber: o.installmentNumber,
        amount: o.amount,
        paidAmount: o.paidAmount,
        dueDate: o.dueDate,
        status: o.status,
        saleId: o.saleId,
      })),
      newInstallmentsDetail: news.map(n => ({
        id: n.id,
        installmentNumber: n.installmentNumber,
        amount: n.amount,
        paidAmount: n.paidAmount,
        dueDate: n.dueDate,
        status: n.status,
      })),
      description: log.description,
    }
  })

  return NextResponse.json({ renegociacoes })
}
