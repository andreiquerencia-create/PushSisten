import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { syncOverdueInstallments } from '@/lib/crediario-sync'

// GET — listar parcelas com filtros
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId

  // Sincronizar vencidos antes de listar
  await syncOverdueInstallments(companyId)

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId') || ''
  const status = searchParams.get('status') || ''
  const saleId = searchParams.get('saleId') || ''
  const overdue = searchParams.get('overdue') === 'true'

  const now = new Date()
  const where: any = { companyId }
  if (customerId) where.customerId = customerId
  if (saleId) where.saleId = saleId
  if (status) where.status = status
  if (overdue) {
    where.status = 'OVERDUE'
  }

  const installments = await prisma.installment.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, cpfCnpj: true, phone: true } },
      sale: { select: { id: true, saleNumber: true, companySaleNumber: true, total: true, createdAt: true } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
    orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
  })

  return NextResponse.json(installments)
}
