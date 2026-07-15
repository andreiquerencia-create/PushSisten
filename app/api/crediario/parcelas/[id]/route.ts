import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET — detalhes de uma parcela
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId

  const installment = await prisma.installment.findFirst({
    where: { id: params.id, companyId },
    include: {
      customer: { select: { id: true, name: true, cpfCnpj: true } },
      sale: { select: { id: true, saleNumber: true, companySaleNumber: true, total: true } },
      payments: {
        orderBy: { paymentDate: 'desc' },
        include: { cashAccount: { select: { name: true } } },
      },
    },
  })

  if (!installment) return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 })

  return NextResponse.json(installment)
}
