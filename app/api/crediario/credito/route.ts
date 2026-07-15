import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET — listar todos os créditos de clientes da empresa
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const customerId = searchParams.get('customerId') || ''

  const credits = await prisma.customerCredit.findMany({
    where: {
      companyId,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        customer: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { cpfCnpj: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ]
        }
      } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, cpfCnpj: true, phone: true, whatsapp: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Calcular availableLimit
  const result = credits.map(c => ({
    ...c,
    availableLimit: c.creditLimit - c.usedLimit,
  }))

  return NextResponse.json(result)
}

// POST — criar/ativar crédito para um cliente
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const companyId = session.user.companyId
  const role = session.user.role
  if (role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const { customerId, creditLimit, defaultTermDays, notes } = body

  if (!customerId || !creditLimit || creditLimit <= 0) {
    return NextResponse.json({ error: 'customerId e creditLimit são obrigatórios' }, { status: 400 })
  }

  // Verificar se cliente pertence à empresa
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } })
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  // Upsert — pode já existir
  const credit = await prisma.customerCredit.upsert({
    where: { customerId },
    create: {
      customerId,
      companyId,
      creditLimit: Number(creditLimit),
      defaultTermDays: defaultTermDays ? Number(defaultTermDays) : 30,
      notes: notes || null,
      status: 'ACTIVE',
    },
    update: {
      creditLimit: Number(creditLimit),
      defaultTermDays: defaultTermDays ? Number(defaultTermDays) : undefined,
      notes: notes !== undefined ? notes : undefined,
      status: 'ACTIVE',
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ ...credit, availableLimit: credit.creditLimit - credit.usedLimit }, { status: 201 })
}
