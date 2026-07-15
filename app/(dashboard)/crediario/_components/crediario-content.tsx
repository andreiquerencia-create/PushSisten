'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toast } from 'sonner'
import { formatSaleNumber } from '@/lib/sale-number'
import {
  CreditCard, Users, AlertTriangle, CheckCircle2, Clock, Ban,
  Plus, Search, Filter, TrendingUp, TrendingDown, DollarSign,
  Receipt, Eye, Banknote, ShieldAlert, BarChart3, ArrowUpRight,
  Calendar, ChevronRight, Wallet, RefreshCw, Printer, History, FileText
} from 'lucide-react'
import {
  buildRecebimentoReceiptHTML, buildRenegociacaoReceiptHTML, printReceiptHTML,
  type CompanyInfo, type RecebimentoReceiptData, type RenegociacaoReceiptData,
} from './receipt-utils'

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'outline' },
  PARTIAL: { label: 'Parcial', variant: 'secondary' },
  PAID: { label: 'Pago', variant: 'default' },
  OVERDUE: { label: 'Vencido', variant: 'destructive' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  RENEGOTIATED: { label: 'Renegociado', variant: 'secondary' },
}

const CREDIT_STATUS: Record<string, { label: string; variant: 'default' | 'destructive' }> = {
  ACTIVE: { label: 'Ativo', variant: 'default' },
  BLOCKED: { label: 'Bloqueado', variant: 'destructive' },
}

export default function CrediarioContent() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // Dashboard
  const [dashboard, setDashboard] = useState<any>(null)

  // Créditos
  const [credits, setCredits] = useState<any[]>([])
  const [creditSearch, setCreditSearch] = useState('')
  const [creditFilter, setCreditFilter] = useState('')
  const [creditDialog, setCreditDialog] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [creditForm, setCreditForm] = useState({
    customerId: '', creditLimit: 0, defaultTermDays: '30', notes: '',
  })
  const [editingCredit, setEditingCredit] = useState<any>(null)

  // Parcelas
  const [installments, setInstallments] = useState<any[]>([])
  const [instSearch, setInstSearch] = useState('')
  const [instFilter, setInstFilter] = useState('')
  const [showOverdue, setShowOverdue] = useState(false)

  // Recebimentos
  const [receiveDialog, setReceiveDialog] = useState(false)
  const [selectedInstallments, setSelectedInstallments] = useState<string[]>([])
  const [receiveAmounts, setReceiveAmounts] = useState<Record<string, number>>({})
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [selectedCashAccount, setSelectedCashAccount] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [receiveNotes, setReceiveNotes] = useState('')

  // Extrato
  const [extratoDialog, setExtratoDialog] = useState(false)
  const [extratoCustomer, setExtratoCustomer] = useState<any>(null)
  const [extratoData, setExtratoData] = useState<any[]>([])

  // ═══ Renegociação ═══
  const [renegDialog, setRenegDialog] = useState(false)
  const [renegEntryAmount, setRenegEntryAmount] = useState(0)
  const [renegNewInstallments, setRenegNewInstallments] = useState(1)
  const [renegFirstDueDate, setRenegFirstDueDate] = useState('')
  const [renegTermDays, setRenegTermDays] = useState(30)
  const [renegCashAccount, setRenegCashAccount] = useState('')
  const [renegPaymentMethod, setRenegPaymentMethod] = useState('')
  const [renegNotes, setRenegNotes] = useState('')
  const [renegSubmitting, setRenegSubmitting] = useState(false)

  // ═══ Comprovante / Empresa ═══
  // ─── Histórico de Renegociações ───
  const [renegociacoes, setRenegociacoes] = useState<any[]>([])
  const [renegLoading, setRenegLoading] = useState(false)
  const [renegHistSearch, setRenegHistSearch] = useState('')
  const [renegDetail, setRenegDetail] = useState<any>(null)
  const [renegDetailDialog, setRenegDetailDialog] = useState(false)

  const [company, setCompany] = useState<CompanyInfo>({})
  const [comprovanteDialog, setComprovanteDialog] = useState(false)
  const [comprovanteType, setComprovanteType] = useState<'recebimento' | 'renegociacao'>('recebimento')
  const [recebimentoReceipt, setRecebimentoReceipt] = useState<RecebimentoReceiptData | null>(null)
  const [renegociacaoReceipt, setRenegociacaoReceipt] = useState<RenegociacaoReceiptData | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/crediario/dashboard')
      if (res.ok) setDashboard(await res.json())
    } catch { /* */ }
  }, [])

  const fetchCredits = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (creditSearch) params.set('search', creditSearch)
      if (creditFilter) params.set('status', creditFilter)
      const res = await fetch(`/api/crediario/credito?${params}`)
      if (res.ok) setCredits(await res.json())
    } catch { /* */ }
  }, [creditSearch, creditFilter])

  const fetchInstallments = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (instFilter) params.set('status', instFilter)
      if (showOverdue) params.set('overdue', 'true')
      const res = await fetch(`/api/crediario/parcelas?${params}`)
      if (res.ok) {
        const data = await res.json()
        // Status OVERDUE agora é persistido no banco pelo syncOverdueInstallments
        setInstallments(data)
      }
    } catch { /* */ }
  }, [instFilter, showOverdue])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/clientes?limit=1000')
      if (res.ok) {
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : data.customers || [])
      }
    } catch { /* */ }
  }, [])

  const fetchCashAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/caixas')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data?.accounts ?? [])
        setCashAccounts(list.filter((c: any) => c.isActive))
      }
    } catch { /* */ }
  }, [])

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch('/api/empresa')
      if (res.ok) setCompany(await res.json())
    } catch { /* */ }
  }, [])

  const fetchRenegociacoes = useCallback(async () => {
    setRenegLoading(true)
    try {
      const res = await fetch('/api/crediario/renegociacoes')
      if (res.ok) {
        const data = await res.json()
        setRenegociacoes(data?.renegociacoes ?? [])
      }
    } catch { /* */ } finally {
      setRenegLoading(false)
    }
  }, [])

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/formas-pagamento')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data?.methods ?? data?.paymentMethods ?? [])
        setPaymentMethods(list.filter((m: any) => m.isActive && m.type !== 'crediario'))
      }
    } catch { /* */ }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchDashboard(), fetchCredits(), fetchInstallments(), fetchCustomers(), fetchCashAccounts(), fetchPaymentMethods(), fetchCompany()])
      setLoading(false)
    }
    load()
  }, [fetchDashboard, fetchCredits, fetchInstallments, fetchCustomers, fetchCashAccounts, fetchPaymentMethods, fetchCompany])

  // Refetch on tab change
  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard()
    else if (activeTab === 'creditos') fetchCredits()
    else if (activeTab === 'parcelas') fetchInstallments()
    else if (activeTab === 'renegociacoes') fetchRenegociacoes()
  }, [activeTab, fetchDashboard, fetchCredits, fetchInstallments, fetchRenegociacoes])

  // ═══ Handlers ═══
  const handleSaveCredit = async () => {
    const { customerId, creditLimit, defaultTermDays, notes } = creditForm
    if (!customerId || creditLimit <= 0) {
      toast.error('Selecione o cliente e informe o limite')
      return
    }

    try {
      const url = editingCredit
        ? `/api/crediario/credito/${editingCredit.customerId}`
        : '/api/crediario/credito'
      const method = editingCredit ? 'PUT' : 'POST'
      const body: any = { creditLimit, defaultTermDays: Number(defaultTermDays), notes }
      if (!editingCredit) body.customerId = customerId
      if (editingCredit?.statusChange) body.status = editingCredit.statusChange

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }

      toast.success(editingCredit ? 'Crédito atualizado' : 'Crédito criado')
      setCreditDialog(false)
      setEditingCredit(null)
      setCreditForm({ customerId: '', creditLimit: 0, defaultTermDays: '30', notes: '' })
      fetchCredits()
      fetchDashboard()
    } catch { toast.error('Erro ao salvar') }
  }

  const handleToggleBlock = async (credit: any) => {
    const newStatus = credit.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/crediario/credito/${credit.customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(newStatus === 'BLOCKED' ? 'Cliente bloqueado' : 'Cliente desbloqueado')
        fetchCredits()
        fetchDashboard()
      }
    } catch { toast.error('Erro') }
  }

  const handleSelectInstallment = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedInstallments(prev => [...prev, id])
      const inst = installments.find(i => i.id === id)
      if (inst) {
        setReceiveAmounts(prev => ({
          ...prev,
          [id]: Math.round((inst.amount - inst.paidAmount) * 100) / 100,
        }))
      }
    } else {
      setSelectedInstallments(prev => prev.filter(x => x !== id))
      setReceiveAmounts(prev => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    }
  }

  const handleReceive = async () => {
    if (!selectedInstallments.length) { toast.error('Selecione ao menos uma parcela'); return }
    if (!selectedPaymentMethod) { toast.error('Selecione a forma de pagamento'); return }
    const payMethod = paymentMethods.find(m => m.id === selectedPaymentMethod)
    const destCashAccountId = payMethod?.cashAccountId || ''
    if (!destCashAccountId) { toast.error('A forma de pagamento escolhida não tem caixa vinculado. Edite-a em Formas de Pagamento.'); return }

    const amounts = selectedInstallments.map(id => {
      const raw = receiveAmounts[id] || 0
      return Math.round(raw * 100) / 100
    })

    if (amounts.some(a => a <= 0)) { toast.error('Valores devem ser maiores que zero'); return }

    try {
      const res = await fetch('/api/crediario/recebimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installmentIds: selectedInstallments,
          amounts,
          cashAccountId: destCashAccountId,
          paymentMethodId: selectedPaymentMethod,
          notes: receiveNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro no recebimento'); return }

      // Montar dados do comprovante antes de limpar o estado
      const paidInstallments = selectedInstallments
        .map(id => installments.find(i => i.id === id))
        .filter(Boolean) as any[]
      const receipt: RecebimentoReceiptData = {
        customerName: paidInstallments[0]?.customer?.name || 'Cliente',
        customerDoc: paidInstallments[0]?.customer?.cpfCnpj || null,
        dateTime: new Date().toLocaleString('pt-BR'),
        items: paidInstallments.map((inst, idx) => ({
          saleNumber: inst.sale ? formatSaleNumber(inst.sale.companySaleNumber, inst.sale.saleNumber) : '—',
          installmentNumber: inst.installmentNumber,
          amount: amounts[selectedInstallments.indexOf(inst.id)] ?? (receiveAmounts[inst.id] || 0),
        })),
        paymentMethod: payMethod?.name,
        cashAccount: cashAccounts.find(c => c.id === destCashAccountId)?.name,
        total: data.totalPaid,
        notes: receiveNotes || undefined,
      }

      toast.success(`Recebido: ${fmt(data.totalPaid)}`)
      setReceiveDialog(false)
      setSelectedInstallments([])
      setReceiveAmounts({})
      setSelectedPaymentMethod('')
      setReceiveNotes('')
      fetchInstallments()
      fetchDashboard()
      fetchCredits()

      // Abrir comprovante de recebimento
      setRecebimentoReceipt(receipt)
      setComprovanteType('recebimento')
      setComprovanteDialog(true)
    } catch { toast.error('Erro ao processar recebimento') }
  }

  // ═══ Renegociação ═══
  const openRenegDialog = () => {
    if (selectedInstallments.length === 0) { toast.error('Selecione ao menos uma parcela'); return }
    const selected = selectedInstallments
      .map(id => installments.find(i => i.id === id))
      .filter(Boolean) as any[]
    // Todas devem ser do mesmo cliente e da mesma venda
    const customerIds = new Set(selected.map(i => i.customerId))
    const saleIds = new Set(selected.map(i => i.saleId ?? i.sale?.id))
    if (customerIds.size > 1) {
      toast.error('Selecione parcelas de um único cliente para renegociar')
      return
    }
    if (saleIds.size > 1) {
      toast.error('Selecione parcelas de uma única venda para renegociar')
      return
    }
    // Status válidos: somente parcelas em aberto
    const invalid = selected.find(i => !['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status))
    if (invalid) {
      toast.error('Somente parcelas em aberto podem ser renegociadas')
      return
    }
    // Defaults
    setRenegEntryAmount(0)
    setRenegNewInstallments(1)
    setRenegTermDays(30)
    setRenegCashAccount('')
    setRenegPaymentMethod('')
    setRenegNotes('')
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setRenegFirstDueDate(d.toISOString().slice(0, 10))
    setRenegDialog(true)
  }

  const handleRenegociar = async () => {
    const selected = selectedInstallments
      .map(id => installments.find(i => i.id === id))
      .filter(Boolean) as any[]
    if (selected.length === 0) { toast.error('Selecione ao menos uma parcela'); return }

    const totalOpen = selected.reduce((s, i) => s + (i.amount - i.paidAmount), 0)
    const entry = Math.round((renegEntryAmount || 0) * 100) / 100
    if (entry < 0) { toast.error('Entrada inválida'); return }
    if (entry > totalOpen + 0.01) { toast.error('Entrada não pode exceder o saldo em aberto'); return }
    const renegPm = paymentMethods.find(m => m.id === renegPaymentMethod)
    const renegDestCashAccountId = renegPm?.cashAccountId || ''
    if (entry > 0 && !renegPaymentMethod) { toast.error('Selecione a forma de pagamento da entrada'); return }
    if (entry > 0 && !renegDestCashAccountId) { toast.error('A forma de pagamento escolhida não tem caixa vinculado. Edite-a em Formas de Pagamento.'); return }
    if (renegNewInstallments < 1) { toast.error('Número de novas parcelas deve ser ≥ 1'); return }
    if (!renegFirstDueDate) { toast.error('Informe a primeira data de vencimento'); return }

    const customerId = selected[0].customerId

    setRenegSubmitting(true)
    try {
      const res = await fetch('/api/crediario/renegociacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          installmentIds: selectedInstallments,
          entryAmount: entry,
          newInstallments: Number(renegNewInstallments),
          firstDueDate: renegFirstDueDate,
          termDays: Number(renegTermDays) || 30,
          cashAccountId: entry > 0 ? renegDestCashAccountId : undefined,
          paymentMethodId: entry > 0 ? renegPaymentMethod : undefined,
          notes: renegNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro na renegociação'); setRenegSubmitting(false); return }

      const receipt: RenegociacaoReceiptData = {
        customerName: selected[0]?.customer?.name || 'Cliente',
        customerDoc: selected[0]?.customer?.cpfCnpj || null,
        dateTime: new Date().toLocaleString('pt-BR'),
        renegotiationRef: data.renegotiationRef,
        oldItems: selected.map(i => ({
          saleNumber: i.sale ? formatSaleNumber(i.sale.companySaleNumber, i.sale.saleNumber) : '—',
          installmentNumber: i.installmentNumber,
          amount: i.amount - i.paidAmount,
        })),
        originalTotal: data.originalTotal,
        entryAmount: data.entryAmount,
        newBalance: data.newBalance,
        newItems: (data.newInstallmentDetails || []).map((d: any) => ({
          installmentNumber: d.installmentNumber,
          amount: d.amount,
          dueDate: d.dueDate,
        })),
        paymentMethod: entry > 0 ? renegPm?.name : undefined,
        cashAccount: entry > 0 ? (renegPm?.cashAccount?.name || cashAccounts.find(c => c.id === renegDestCashAccountId)?.name) : undefined,
        notes: renegNotes || undefined,
      }

      toast.success(`Renegociação concluída — ${data.renegotiationRef}`)
      setRenegDialog(false)
      setSelectedInstallments([])
      setReceiveAmounts({})
      setRenegSubmitting(false)
      fetchInstallments()
      fetchDashboard()
      fetchCredits()

      setRenegociacaoReceipt(receipt)
      setComprovanteType('renegociacao')
      setComprovanteDialog(true)
    } catch {
      toast.error('Erro ao processar renegociação')
      setRenegSubmitting(false)
    }
  }

  const handlePrintComprovante = () => {
    let html = ''
    if (comprovanteType === 'recebimento' && recebimentoReceipt) {
      html = buildRecebimentoReceiptHTML(company, recebimentoReceipt)
    } else if (comprovanteType === 'renegociacao' && renegociacaoReceipt) {
      html = buildRenegociacaoReceiptHTML(company, renegociacaoReceipt)
    }
    if (html) {
      const ok = printReceiptHTML(html)
      if (!ok) toast.error('Permita pop-ups para imprimir o comprovante')
    }
  }

  // Reimprime o comprovante de uma renegociação do histórico
  const handleReprintReneg = (reneg: any) => {
    const receipt: RenegociacaoReceiptData = {
      customerName: reneg.customerName ?? 'Cliente',
      customerDoc: reneg.customerDoc ?? undefined,
      dateTime: new Date(reneg.renegotiatedAt).toLocaleString('pt-BR'),
      renegotiationRef: reneg.renegotiationRef,
      oldItems: (reneg.originalInstallments ?? []).map((o: any) => ({
        saleNumber: reneg.saleNumber != null || reneg.companySaleNumber != null ? formatSaleNumber(reneg.companySaleNumber, reneg.saleNumber) : 0,
        installmentNumber: o.installmentNumber,
        amount: o.amount,
      })),
      originalTotal: reneg.originalTotal ?? 0,
      entryAmount: reneg.entryAmount ?? 0,
      newBalance: reneg.newBalance ?? 0,
      newItems: (reneg.newInstallmentsDetail ?? []).map((n: any) => ({
        installmentNumber: n.installmentNumber,
        amount: n.amount,
        dueDate: n.dueDate,
      })),
    }
    const html = buildRenegociacaoReceiptHTML(company, receipt)
    const ok = printReceiptHTML(html)
    if (!ok) toast.error('Permita pop-ups para imprimir o comprovante')
  }

  const openExtrato = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId) || credits.find(c => c.customerId === customerId)?.customer
    setExtratoCustomer(customer)
    try {
      const res = await fetch(`/api/crediario/parcelas?customerId=${customerId}`)
      if (res.ok) setExtratoData(await res.json())
    } catch { /* */ }
    setExtratoDialog(true)
  }

  // Filter installments by search
  const filteredInstallments = instSearch
    ? installments.filter(i =>
        i.customer?.name?.toLowerCase().includes(instSearch.toLowerCase()) ||
        (i.sale ? formatSaleNumber(i.sale.companySaleNumber, i.sale.saleNumber) : '').includes(instSearch)
      )
    : installments

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Crediário
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gestão de crédito, parcelas e recebimentos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" /> Painel
          </TabsTrigger>
          <TabsTrigger value="creditos" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Créditos
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="flex items-center gap-1.5">
            <Receipt className="w-4 h-4" /> Parcelas
          </TabsTrigger>
          <TabsTrigger value="renegociacoes" className="flex items-center gap-1.5">
            <History className="w-4 h-4" /> Renegociações
          </TabsTrigger>
        </TabsList>

        {/* ═══ DASHBOARD ═══ */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {dashboard && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Total a Receber</p>
                        <p className="text-xl font-bold num-highlight">{fmt(dashboard.totalAReceber)}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Vencido</p>
                        <p className="text-xl font-bold num-highlight text-red-600">{fmt(dashboard.totalVencido)}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Recebido (30d)</p>
                        <p className="text-xl font-bold num-highlight text-green-600">{fmt(dashboard.recebimentos30d?.total)}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Inadimplência</p>
                        <p className="text-xl font-bold num-highlight">{dashboard.taxaInadimplencia?.toFixed(1)}%</p>
                      </div>
                      <ShieldAlert className="w-8 h-8 text-amber-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Crédito */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> Crédito
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Liberado</span>
                      <span className="font-medium num-highlight">{fmt(dashboard.totalCreditoLiberado)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilizado</span>
                      <span className="font-medium num-highlight">{fmt(dashboard.totalCreditoUtilizado)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Disponível</span>
                      <span className="font-medium text-green-600 num-highlight">{fmt(dashboard.totalCreditoDisponivel)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${dashboard.totalCreditoLiberado > 0 ? (dashboard.totalCreditoUtilizado / dashboard.totalCreditoLiberado * 100) : 0}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="text-center">
                        <p className="text-lg font-bold num-highlight">{dashboard.totalClientes}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600 num-highlight">{dashboard.clientesAtivos}</p>
                        <p className="text-xs text-muted-foreground">Ativos</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-red-600 num-highlight">{dashboard.clientesBloqueados}</p>
                        <p className="text-xs text-muted-foreground">Bloqueados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Devedores */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" /> Maiores Devedores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.topDevedores?.length > 0 ? (
                      <div className="space-y-3">
                        {dashboard.topDevedores.map((d: any, idx: number) => (
                          <div key={d.customerId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                              <button
                                onClick={() => openExtrato(d.customerId)}
                                className="text-sm font-medium hover:text-primary transition-colors text-left"
                              >
                                {d.customerName}
                              </button>
                            </div>
                            <span className="text-sm font-semibold text-red-600 num-highlight">{fmt(d.totalDevido)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum devedor</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Status das parcelas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Distribuição por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {dashboard.parcelasStatus?.map((p: any) => {
                      const cfg = STATUS_BADGE[p.status] || { label: p.status, variant: 'outline' as const }
                      return (
                        <div key={p.status} className="text-center p-3 rounded-lg bg-muted/30">
                          <Badge variant={cfg.variant} className="mb-2">{cfg.label}</Badge>
                          <p className="text-lg font-bold num-highlight">{p.count}</p>
                          <p className="text-xs text-muted-foreground">{fmt(p.total)}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══ CRÉDITOS ═══ */}
        <TabsContent value="creditos" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-1 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, telefone..."
                  className="pl-9"
                  value={creditSearch}
                  onChange={e => setCreditSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchCredits()}
                />
              </div>
              <Select value={creditFilter} onValueChange={v => { setCreditFilter(v === 'all' ? '' : v) }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativos</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => {
              setEditingCredit(null)
              setCreditForm({ customerId: '', creditLimit: 0, defaultTermDays: '30', notes: '' })
              setCreditDialog(true)
            }}>
              <Plus className="w-4 h-4 mr-1" /> Novo Crédito
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Limite</TableHead>
                    <TableHead className="text-right">Utilizado</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-center">Prazo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum crédito cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    credits.map(c => {
                      const avail = c.creditLimit - c.usedLimit
                      const pct = c.creditLimit > 0 ? (c.usedLimit / c.creditLimit * 100) : 0
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <button onClick={() => openExtrato(c.customerId)} className="font-medium hover:text-primary">
                              {c.customer?.name}
                            </button>
                            {c.customer?.cpfCnpj && <p className="text-xs text-muted-foreground">{c.customer.cpfCnpj}</p>}
                          </TableCell>
                          <TableCell className="text-right num-highlight">{fmt(c.creditLimit)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`num-highlight ${pct > 80 ? 'text-red-600' : pct > 50 ? 'text-amber-600' : ''}`}>
                              {fmt(c.usedLimit)}
                            </span>
                            <div className="h-1 bg-muted rounded-full mt-1 w-16 ml-auto">
                              <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right num-highlight text-green-600">{fmt(avail)}</TableCell>
                          <TableCell className="text-center">{c.defaultTermDays}d</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={CREDIT_STATUS[c.status]?.variant || 'outline'}>
                              {CREDIT_STATUS[c.status]?.label || c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openExtrato(c.customerId)} title="Extrato">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setEditingCredit(c)
                                setCreditForm({
                                  customerId: c.customerId,
                                  creditLimit: c.creditLimit,
                                  defaultTermDays: String(c.defaultTermDays),
                                  notes: c.notes || '',
                                })
                                setCreditDialog(true)
                              }} title="Editar">
                                <CreditCard className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleBlock(c)}
                                title={c.status === 'ACTIVE' ? 'Bloquear' : 'Desbloquear'}
                              >
                                {c.status === 'ACTIVE' ? <Ban className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ PARCELAS ═══ */}
        <TabsContent value="parcelas" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-1 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente ou nº venda..."
                  className="pl-9"
                  value={instSearch}
                  onChange={e => setInstSearch(e.target.value)}
                />
              </div>
              <Select value={instFilter || 'all'} onValueChange={v => setInstFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="PARTIAL">Parcial</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="OVERDUE">Vencido</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showOverdue ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowOverdue(!showOverdue)}
                className="whitespace-nowrap"
              >
                <AlertTriangle className="w-4 h-4 mr-1" /> Vencidas
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={openRenegDialog}
                disabled={selectedInstallments.length === 0}
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Renegociar
              </Button>
              <Button
                onClick={() => {
                  if (selectedInstallments.length === 0) {
                    toast.error('Selecione ao menos uma parcela')
                    return
                  }
                  setReceiveDialog(true)
                }}
                disabled={selectedInstallments.length === 0}
              >
                <Banknote className="w-4 h-4 mr-1" /> Receber ({selectedInstallments.length})
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead className="text-center">Nº</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Restante</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstallments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhuma parcela encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInstallments.map(inst => {
                      const remaining = inst.amount - inst.paidAmount
                      const isOverdue = inst.status === 'OVERDUE'
                      const canSelect = inst.status !== 'PAID' && inst.status !== 'CANCELLED' && inst.status !== 'RENEGOTIATED'
                      const isSelected = selectedInstallments.includes(inst.id)
                      return (
                        <TableRow key={inst.id} className={isOverdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                          <TableCell>
                            {canSelect && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => handleSelectInstallment(inst.id, e.target.checked)}
                                className="w-4 h-4 rounded border-muted"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <button onClick={() => openExtrato(inst.customerId)} className="font-medium hover:text-primary text-sm">
                              {inst.customer?.name}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">#{inst.sale ? formatSaleNumber(inst.sale.companySaleNumber, inst.sale.saleNumber) : '—'}</TableCell>
                          <TableCell className="text-center text-sm">{inst.installmentNumber}</TableCell>
                          <TableCell className="text-right num-highlight text-sm">{fmt(inst.amount)}</TableCell>
                          <TableCell className="text-right num-highlight text-sm">{fmt(inst.paidAmount)}</TableCell>
                          <TableCell className="text-right font-medium num-highlight text-sm">{fmt(remaining)}</TableCell>
                          <TableCell className="text-center text-sm">
                            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                              {fmtDate(inst.dueDate)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={STATUS_BADGE[inst.status]?.variant || 'outline'}>
                              {STATUS_BADGE[inst.status]?.label || inst.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ═══ HISTÓRICO DE RENEGOCIAÇÕES ═══ */}
        <TabsContent value="renegociacoes" className="space-y-4 mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="w-5 h-5 text-primary" /> Histórico de Renegociações
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente ou referência..."
                      value={renegHistSearch}
                      onChange={e => setRenegHistSearch(e.target.value)}
                      className="pl-8 w-full sm:w-72"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchRenegociacoes} title="Atualizar">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renegLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (() => {
                const term = renegHistSearch.trim().toLowerCase()
                const list = term
                  ? renegociacoes.filter(r =>
                      (r.customerName || '').toLowerCase().includes(term) ||
                      (r.renegotiationRef || '').toLowerCase().includes(term) ||
                      (r.saleNumber != null || r.companySaleNumber != null ? formatSaleNumber(r.companySaleNumber, r.saleNumber) : '').includes(term)
                    )
                  : renegociacoes
                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Nenhuma renegociação registrada ainda.</p>
                    </div>
                  )
                }
                return (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Referência</TableHead>
                          <TableHead className="text-right">Saldo Original</TableHead>
                          <TableHead className="text-right">Entrada</TableHead>
                          <TableHead className="text-right">Novo Saldo</TableHead>
                          <TableHead className="text-center">Novas</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map(r => (
                          <TableRow key={r.renegotiationRef}>
                            <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.renegotiatedAt)}</TableCell>
                            <TableCell>
                              <div className="font-medium">{r.customerName}</div>
                              {(r.saleNumber != null || r.companySaleNumber != null) && <div className="text-xs text-muted-foreground">Venda #{formatSaleNumber(r.companySaleNumber, r.saleNumber)}</div>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.renegotiationRef}</TableCell>
                            <TableCell className="text-right num-highlight">{fmt(r.originalTotal)}</TableCell>
                            <TableCell className="text-right num-highlight">{fmt(r.entryAmount)}</TableCell>
                            <TableCell className="text-right font-semibold text-primary num-highlight">{fmt(r.newBalance)}</TableCell>
                            <TableCell className="text-center">{r.newInstallmentsCount}x</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => { setRenegDetail(r); setRenegDetailDialog(true) }}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Reimprimir comprovante" onClick={() => handleReprintReneg(r)}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ Dialog: Novo/Editar Crédito ═══ */}
      <Dialog open={creditDialog} onOpenChange={setCreditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCredit ? 'Editar Crédito' : 'Novo Crédito'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingCredit && (
              <div>
                <Label>Cliente *</Label>
                <Select value={creditForm.customerId} onValueChange={v => setCreditForm({ ...creditForm, customerId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.cpfCnpj ? ` (${c.cpfCnpj})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Limite de Crédito *</Label>
              <CurrencyInput
                value={creditForm.creditLimit}
                onChange={v => setCreditForm({ ...creditForm, creditLimit: v })}
              />
            </div>
            <div>
              <Label>Prazo Padrão (dias)</Label>
              <Input
                type="number"
                min={1}
                value={creditForm.defaultTermDays}
                onChange={e => setCreditForm({ ...creditForm, defaultTermDays: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={creditForm.notes}
                onChange={e => setCreditForm({ ...creditForm, notes: e.target.value })}
                placeholder="Observações sobre o crédito..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCredit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Recebimento ═══ */}
      <Dialog open={receiveDialog} onOpenChange={setReceiveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5" /> Receber Parcelas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Forma de Pagamento *</Label>
              <Select value={selectedPaymentMethod} onValueChange={(v) => { setSelectedPaymentMethod(v); const pm = paymentMethods.find(m => m.id === v); setSelectedCashAccount(pm?.cashAccountId || '') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Como o cliente pagou? (Dinheiro, PIX...)" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.filter(m => m.type !== 'crediario').map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}{m.cashAccount?.name ? ` → ${m.cashAccount.name}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPaymentMethod && (() => {
                const pm = paymentMethods.find(m => m.id === selectedPaymentMethod)
                const dest = pm?.cashAccount?.name || cashAccounts.find(c => c.id === pm?.cashAccountId)?.name
                return dest ? (
                  <p className="text-xs text-muted-foreground mt-1.5">O valor cairá automaticamente no caixa: <span className="font-medium text-foreground">{dest}</span></p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1.5">Esta forma de pagamento não tem caixa vinculado. Edite-a em Formas de Pagamento.</p>
                )
              })()}
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {selectedInstallments.map(id => {
                const inst = installments.find(i => i.id === id)
                if (!inst) return null
                const remaining = inst.amount - inst.paidAmount
                return (
                  <div key={id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{inst.customer?.name} — Parcela {inst.installmentNumber}</span>
                      <span className="text-muted-foreground">Restante: {fmt(remaining)}</span>
                    </div>
                    <div>
                      <Label className="text-xs">Valor a receber</Label>
                      <CurrencyInput
                        value={receiveAmounts[id] || 0}
                        onChange={v => setReceiveAmounts(prev => ({ ...prev, [id]: v }))}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
              <span className="font-medium">Total a receber</span>
              <span className="font-bold text-lg num-highlight">
                {fmt(selectedInstallments.reduce((s, id) => s + (receiveAmounts[id] || 0), 0))}
              </span>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
                placeholder="Observações do recebimento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialog(false)}>Cancelar</Button>
            <Button onClick={handleReceive}>Confirmar Recebimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Renegociar Parcelas ═══ */}
      <Dialog open={renegDialog} onOpenChange={setRenegDialog}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" /> Renegociar Parcelas
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const selected = selectedInstallments
              .map(id => installments.find(i => i.id === id))
              .filter(Boolean) as any[]
            const saldoAberto = Math.round(selected.reduce((s, i) => s + (i.amount - i.paidAmount), 0) * 100) / 100
            const entrada = Math.round((renegEntryAmount || 0) * 100) / 100
            const novoSaldo = Math.round((saldoAberto - entrada) * 100) / 100
            const nParcelas = Math.max(1, Number(renegNewInstallments) || 1)
            const valorParcela = Math.round((novoSaldo / nParcelas) * 100) / 100
            const cliente = selected[0]?.customer?.name || '—'
            // Datas previstas
            const datas: string[] = []
            if (renegFirstDueDate) {
              const base = new Date(renegFirstDueDate + 'T00:00:00')
              for (let i = 0; i < nParcelas; i++) {
                const d = new Date(base)
                d.setDate(d.getDate() + i * (Number(renegTermDays) || 30))
                datas.push(d.toLocaleDateString('pt-BR'))
              }
            }
            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{cliente}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Parcelas selecionadas</span><span className="font-medium">{selected.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo em aberto</span><span className="font-bold num-highlight">{fmt(saldoAberto)}</span></div>
                </div>

                <div>
                  <Label>Entrada (opcional)</Label>
                  <CurrencyInput value={renegEntryAmount} onChange={setRenegEntryAmount} />
                </div>

                {entrada > 0 && (
                  <div>
                    <Label>Forma de Pagamento (entrada) *</Label>
                    <Select value={renegPaymentMethod} onValueChange={(v) => { setRenegPaymentMethod(v); const pm = paymentMethods.find(m => m.id === v); setRenegCashAccount(pm?.cashAccountId || '') }}>
                      <SelectTrigger><SelectValue placeholder="Como o cliente pagou? (Dinheiro, PIX...)" /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(m => m.type !== 'crediario').map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}{m.cashAccount?.name ? ` → ${m.cashAccount.name}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {renegPaymentMethod && (() => {
                      const pm = paymentMethods.find(m => m.id === renegPaymentMethod)
                      const dest = pm?.cashAccount?.name || cashAccounts.find(c => c.id === pm?.cashAccountId)?.name
                      return dest ? (
                        <p className="text-xs text-muted-foreground mt-1.5">A entrada cairá no caixa: <span className="font-medium text-foreground">{dest}</span></p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-1.5">Esta forma de pagamento não tem caixa vinculado. Edite-a em Formas de Pagamento.</p>
                      )
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nº de novas parcelas *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={renegNewInstallments}
                      onChange={e => setRenegNewInstallments(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div>
                    <Label>Intervalo (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={renegTermDays}
                      onChange={e => setRenegTermDays(Math.max(1, parseInt(e.target.value) || 30))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Primeira data de vencimento *</Label>
                  <Input type="date" value={renegFirstDueDate} onChange={e => setRenegFirstDueDate(e.target.value)} />
                </div>

                {/* Resumo */}
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Resumo do acordo</p>
                  <div className="flex justify-between text-sm"><span>Saldo em aberto</span><span className="num-highlight">{fmt(saldoAberto)}</span></div>
                  <div className="flex justify-between text-sm"><span>Entrada</span><span className="num-highlight text-cyan-600">- {fmt(entrada)}</span></div>
                  <div className="flex justify-between text-sm font-semibold border-t pt-2"><span>Novo saldo</span><span className="num-highlight text-primary">{fmt(novoSaldo)}</span></div>
                  <div className="flex justify-between text-sm"><span>{nParcelas}x de</span><span className="num-highlight font-bold">{fmt(valorParcela)}</span></div>
                  {datas.length > 0 && (
                    <div className="text-xs text-muted-foreground pt-1">
                      Vencimentos: {datas.slice(0, 6).join(', ')}{datas.length > 6 ? ` … (+${datas.length - 6})` : ''}
                    </div>
                  )}
                  {novoSaldo < 0 && (
                    <p className="text-xs text-red-600">A entrada não pode ser maior que o saldo em aberto.</p>
                  )}
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea value={renegNotes} onChange={e => setRenegNotes(e.target.value)} placeholder="Observações da renegociação..." />
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenegDialog(false)} disabled={renegSubmitting}>Cancelar</Button>
            <Button onClick={handleRenegociar} disabled={renegSubmitting}>
              {renegSubmitting ? 'Processando...' : 'Confirmar Renegociação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Comprovante ═══ */}
      <Dialog open={comprovanteDialog} onOpenChange={setComprovanteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {comprovanteType === 'recebimento' ? 'Recebimento Concluído' : 'Renegociação Concluída'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {comprovanteType === 'recebimento' && recebimentoReceipt && (
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{recebimentoReceipt.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Parcelas</span><span className="font-medium">{recebimentoReceipt.items.length}</span></div>
                <div className="flex justify-between text-base"><span className="font-semibold">Total recebido</span><span className="font-bold text-green-600 num-highlight">{fmt(recebimentoReceipt.total)}</span></div>
              </div>
            )}
            {comprovanteType === 'renegociacao' && renegociacaoReceipt && (
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{renegociacaoReceipt.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ref. do acordo</span><span className="font-medium">{renegociacaoReceipt.renegotiationRef}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Entrada</span><span className="num-highlight">{fmt(renegociacaoReceipt.entryAmount)}</span></div>
                <div className="flex justify-between text-base"><span className="font-semibold">Novo saldo</span><span className="font-bold text-primary num-highlight">{fmt(renegociacaoReceipt.newBalance)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Novas parcelas</span><span className="font-medium">{renegociacaoReceipt.newItems.length}x</span></div>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Imprima ou salve o comprovante para registro.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComprovanteDialog(false)}>Fechar</Button>
            <Button onClick={handlePrintComprovante}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir Comprovante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Extrato do Cliente ═══ */}
      <Dialog open={extratoDialog} onOpenChange={setExtratoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Extrato — {extratoCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {extratoData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma parcela encontrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venda</TableHead>
                    <TableHead className="text-center">Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratoData.map((inst: any) => {
                    const remaining = inst.amount - inst.paidAmount
                    const isOverdue = inst.status === 'OVERDUE'
                    return (
                      <TableRow key={inst.id} className={isOverdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                        <TableCell className="text-sm">#{inst.sale ? formatSaleNumber(inst.sale.companySaleNumber, inst.sale.saleNumber) : '—'}</TableCell>
                        <TableCell className="text-center text-sm">{inst.installmentNumber}</TableCell>
                        <TableCell className="text-right num-highlight text-sm">{fmt(inst.amount)}</TableCell>
                        <TableCell className="text-right num-highlight text-sm">{fmt(inst.paidAmount)}</TableCell>
                        <TableCell className="text-center text-sm">{fmtDate(inst.dueDate)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={STATUS_BADGE[inst.status]?.variant || 'outline'}>
                            {STATUS_BADGE[inst.status]?.label || inst.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {extratoData.length > 0 && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold num-highlight">{fmt(extratoData.reduce((s: number, i: any) => s + i.amount, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Pago</p>
                  <p className="font-bold text-green-600 num-highlight">{fmt(extratoData.reduce((s: number, i: any) => s + i.paidAmount, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Restante</p>
                  <p className="font-bold text-red-600 num-highlight">
                    {fmt(extratoData.reduce((s: number, i: any) => s + (i.amount - i.paidAmount), 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>

      {/* ═══ Dialog: Detalhes da Renegociação ═══ */}
      <Dialog open={renegDetailDialog} onOpenChange={setRenegDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Detalhes da Renegociação
            </DialogTitle>
          </DialogHeader>
          {renegDetail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground block text-xs">Cliente</span><span className="font-medium">{renegDetail.customerName}</span></div>
                <div><span className="text-muted-foreground block text-xs">Documento</span><span className="font-medium">{renegDetail.customerDoc || '—'}</span></div>
                <div><span className="text-muted-foreground block text-xs">Referência do acordo</span><span className="font-mono text-xs">{renegDetail.renegotiationRef}</span></div>
                <div><span className="text-muted-foreground block text-xs">Data</span><span className="font-medium">{new Date(renegDetail.renegotiatedAt).toLocaleString('pt-BR')}</span></div>
                <div><span className="text-muted-foreground block text-xs">Venda original</span><span className="font-medium">{(renegDetail.saleNumber != null || renegDetail.companySaleNumber != null) ? `#${formatSaleNumber(renegDetail.companySaleNumber, renegDetail.saleNumber)}` : '—'}</span></div>
                <div><span className="text-muted-foreground block text-xs">Responsável</span><span className="font-medium">{renegDetail.userName || '—'}</span></div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40">
                <div className="text-center"><span className="text-muted-foreground block text-xs">Saldo Original</span><span className="font-bold num-highlight">{fmt(renegDetail.originalTotal)}</span></div>
                <div className="text-center"><span className="text-muted-foreground block text-xs">Entrada</span><span className="font-bold text-green-600 num-highlight">{fmt(renegDetail.entryAmount)}</span></div>
                <div className="text-center"><span className="text-muted-foreground block text-xs">Novo Saldo</span><span className="font-bold text-primary num-highlight">{fmt(renegDetail.newBalance)}</span></div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-xs uppercase text-muted-foreground">Parcelas Originais ({(renegDetail.originalInstallments ?? []).length})</h4>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">Parcela</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Vencimento</TableHead>
                        <TableHead className="text-center">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(renegDetail.originalInstallments ?? []).map((o: any) => (
                        <TableRow key={o.id}>
                          <TableCell className="text-center">{o.installmentNumber}</TableCell>
                          <TableCell className="text-right num-highlight">{fmt(o.amount)}</TableCell>
                          <TableCell className="text-center">{fmtDate(o.dueDate)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={STATUS_BADGE[o.status]?.variant ?? 'outline'}>{STATUS_BADGE[o.status]?.label ?? o.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-xs uppercase text-muted-foreground">Novas Parcelas ({(renegDetail.newInstallmentsDetail ?? []).length})</h4>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">Parcela</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Vencimento</TableHead>
                        <TableHead className="text-center">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(renegDetail.newInstallmentsDetail ?? []).map((n: any) => (
                        <TableRow key={n.id}>
                          <TableCell className="text-center">{n.installmentNumber}</TableCell>
                          <TableCell className="text-right num-highlight">{fmt(n.amount)}</TableCell>
                          <TableCell className="text-center">{fmtDate(n.dueDate)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={STATUS_BADGE[n.status]?.variant ?? 'outline'}>{STATUS_BADGE[n.status]?.label ?? n.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenegDetailDialog(false)}>Fechar</Button>
            {renegDetail && (
              <Button onClick={() => handleReprintReneg(renegDetail)}>
                <Printer className="w-4 h-4 mr-1" /> Reimprimir Comprovante
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Dialog>
    </div>
  )
}