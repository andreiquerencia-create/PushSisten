import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { syncOverdueInstallments } from '@/lib/crediario-sync'

// GET — indicadores do crediário
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId

  // Sincronizar vencidos antes de calcular métricas
  await syncOverdueInstallments(companyId)

  const now = new Date()

  // Total a receber (parcelas pendentes, parciais ou vencidas)
  const pendingInstallments = await prisma.installment.findMany({
    where: { companyId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    select: { amount: true, paidAmount: true, dueDate: true, customerId: true },
  })

  const totalAReceber = pendingInstallments.reduce((s, i) => s + (i.amount - i.paidAmount), 0)
  const totalVencido = pendingInstallments
    .filter(i => i.dueDate < now)
    .reduce((s, i) => s + (i.amount - i.paidAmount), 0)
  const totalEmDia = totalAReceber - totalVencido

  // Clientes inadimplentes (com parcelas vencidas)
  const clientesInadimplentes = new Set(
    pendingInstallments.filter(i => i.dueDate < now).map(i => i.customerId)
  ).size

  // Total de créditos ativos
  const credits = await prisma.customerCredit.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: { creditLimit: true, usedLimit: true },
  })

  const totalCreditoLiberado = credits.reduce((s, c) => s + c.creditLimit, 0)
  const totalCreditoUtilizado = credits.reduce((s, c) => s + c.usedLimit, 0)
  const totalCreditoDisponivel = totalCreditoLiberado - totalCreditoUtilizado

  // Clientes com crediário
  const totalClientes = await prisma.customerCredit.count({ where: { companyId } })
  const clientesAtivos = credits.length
  const clientesBloqueados = await prisma.customerCredit.count({ where: { companyId, status: 'BLOCKED' } })

  // Taxa de inadimplência
  const taxaInadimplencia = totalAReceber > 0 ? (totalVencido / totalAReceber) * 100 : 0

  // Parcelas por status
  const parcelasStatus = await prisma.installment.groupBy({
    by: ['status'],
    where: { companyId },
    _count: true,
    _sum: { amount: true },
  })

  // Recebimentos últimos 30 dias
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recebimentosRecentes = await prisma.installmentPayment.aggregate({
    where: { companyId, paymentDate: { gte: thirtyDaysAgo } },
    _sum: { amount: true },
    _count: true,
  })

  // Top 5 devedores
  const topDevedores = await prisma.installment.groupBy({
    by: ['customerId'],
    where: { companyId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    _sum: { amount: true, paidAmount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5,
  })

  const topCustomerIds = topDevedores.map(d => d.customerId)
  const topCustomers = await prisma.customer.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, name: true },
  })
  const customerMap = Object.fromEntries(topCustomers.map(c => [c.id, c.name]))

  return NextResponse.json({
    totalAReceber: Math.round(totalAReceber * 100) / 100,
    totalVencido: Math.round(totalVencido * 100) / 100,
    totalEmDia: Math.round(totalEmDia * 100) / 100,
    totalCreditoLiberado: Math.round(totalCreditoLiberado * 100) / 100,
    totalCreditoUtilizado: Math.round(totalCreditoUtilizado * 100) / 100,
    totalCreditoDisponivel: Math.round(totalCreditoDisponivel * 100) / 100,
    totalClientes,
    clientesAtivos,
    clientesBloqueados,
    clientesInadimplentes,
    taxaInadimplencia: Math.round(taxaInadimplencia * 100) / 100,
    parcelasStatus: parcelasStatus.map(p => ({
      status: p.status,
      count: p._count,
      total: Math.round((p._sum.amount || 0) * 100) / 100,
    })),
    recebimentos30d: {
      total: Math.round((recebimentosRecentes._sum.amount || 0) * 100) / 100,
      count: recebimentosRecentes._count,
    },
    topDevedores: topDevedores.map(d => ({
      customerId: d.customerId,
      customerName: customerMap[d.customerId] || 'Desconhecido',
      totalDevido: Math.round(((d._sum.amount || 0) - (d._sum.paidAmount || 0)) * 100) / 100,
    })),
  })
}
