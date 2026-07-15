// Utilitários para gerar e imprimir comprovantes de crediário (recebimento e renegociação)
// Executado no client — usa window.open + window.print para impressão imediata sem dependências externas.

export interface CompanyInfo {
  name?: string | null
  cnpj?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  logoUrl?: string | null
}

export interface RecebimentoReceiptItem {
  saleNumber: number | string
  installmentNumber: number | string
  amount: number
}

export interface RecebimentoReceiptData {
  customerName: string
  customerDoc?: string | null
  dateTime: string
  items: RecebimentoReceiptItem[]
  paymentMethod?: string
  cashAccount?: string
  total: number
  notes?: string
}

export interface RenegociacaoReceiptItem {
  saleNumber: number | string
  installmentNumber: number | string
  amount: number
}

export interface RenegociacaoNewItem {
  installmentNumber: number | string
  amount: number
  dueDate: string
}

export interface RenegociacaoReceiptData {
  customerName: string
  customerDoc?: string | null
  dateTime: string
  renegotiationRef: string
  oldItems: RenegociacaoReceiptItem[]
  originalTotal: number
  entryAmount: number
  newBalance: number
  newItems: RenegociacaoNewItem[]
  paymentMethod?: string
  cashAccount?: string
  notes?: string
}

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function companyHeader(company: CompanyInfo): string {
  const logo = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:54px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:46px;height:46px;border-radius:10px;background:linear-gradient(135deg,#1e40af,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px;">${(company.name || 'P').charAt(0)}</div>`
  const contactBits: string[] = []
  if (company.cnpj) contactBits.push(`CNPJ: ${company.cnpj}`)
  if (company.phone) contactBits.push(`Tel: ${company.phone}`)
  if (company.whatsapp && company.whatsapp !== company.phone) contactBits.push(`WhatsApp: ${company.whatsapp}`)
  const addrBits: string[] = []
  if (company.address) addrBits.push(company.address)
  const cityState = [company.city, company.state].filter(Boolean).join(' - ')
  if (cityState) addrBits.push(cityState)
  return `
    <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:2px solid #e2e8f0;">
      ${logo}
      <div>
        <div style="font-size:18px;font-weight:800;color:#0f172a;">${company.name || 'Empresa'}</div>
        ${addrBits.length ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${addrBits.join(' • ')}</div>` : ''}
        ${contactBits.length ? `<div style="font-size:11px;color:#64748b;margin-top:1px;">${contactBits.join(' • ')}</div>` : ''}
      </div>
    </div>`
}

function wrapDocument(title: string, bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .sheet { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 24px rgba(15,23,42,.08); }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
    td { font-size: 13px; padding: 8px 6px; border-bottom: 1px solid #f1f5f9; }
    .right { text-align: right; }
    .center { text-align: center; }
    .muted { color: #64748b; }
    .badge { display:inline-block; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:700; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border-radius: 0; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${bodyInner}
  </div>
  <div class="no-print" style="max-width:520px;margin:16px auto 0;text-align:center;">
    <button onclick="window.print()" style="background:#1e40af;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Imprimir</button>
    <button onclick="window.close()" style="background:#e2e8f0;color:#0f172a;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-left:8px;">Fechar</button>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ try { window.print(); } catch(e){} }, 350); };</script>
</body>
</html>`
}

export function buildRecebimentoReceiptHTML(company: CompanyInfo, data: RecebimentoReceiptData): string {
  const rows = data.items.map(it => `
    <tr>
      <td>#${it.saleNumber}</td>
      <td class="center">${it.installmentNumber}</td>
      <td class="right">${fmt(it.amount)}</td>
    </tr>`).join('')

  const inner = `
    ${companyHeader(company)}
    <div style="text-align:center;margin:18px 0 8px;">
      <span class="badge" style="background:#d1fae5;color:#059669;">COMPROVANTE DE RECEBIMENTO</span>
    </div>
    <table style="margin-bottom:14px;">
      <tr><td style="border:none;padding:3px 6px;" class="muted">Cliente</td><td style="border:none;padding:3px 6px;" class="right"><strong>${data.customerName}</strong></td></tr>
      ${data.customerDoc ? `<tr><td style="border:none;padding:3px 6px;" class="muted">CPF/CNPJ</td><td style="border:none;padding:3px 6px;" class="right">${data.customerDoc}</td></tr>` : ''}
      <tr><td style="border:none;padding:3px 6px;" class="muted">Data/Hora</td><td style="border:none;padding:3px 6px;" class="right">${data.dateTime}</td></tr>
      ${data.paymentMethod ? `<tr><td style="border:none;padding:3px 6px;" class="muted">Forma de Pagamento</td><td style="border:none;padding:3px 6px;" class="right">${data.paymentMethod}</td></tr>` : ''}
      ${data.cashAccount ? `<tr><td style="border:none;padding:3px 6px;" class="muted">Conta Caixa</td><td style="border:none;padding:3px 6px;" class="right">${data.cashAccount}</td></tr>` : ''}
    </table>
    <table>
      <thead><tr><th>Venda</th><th class="center">Parcela</th><th class="right">Valor Recebido</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:12px 14px;background:#f0fdf4;border-radius:10px;">
      <span style="font-weight:700;color:#065f46;">TOTAL RECEBIDO</span>
      <span style="font-weight:800;font-size:18px;color:#059669;">${fmt(data.total)}</span>
    </div>
    ${data.notes ? `<div style="margin-top:12px;font-size:12px;color:#64748b;"><strong>Observações:</strong> ${data.notes}</div>` : ''}
    <div style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;">Documento gerado eletronicamente • ${data.dateTime}</div>`
  return wrapDocument('Comprovante de Recebimento', inner)
}

export function buildRenegociacaoReceiptHTML(company: CompanyInfo, data: RenegociacaoReceiptData): string {
  const oldRows = data.oldItems.map(it => `
    <tr>
      <td>#${it.saleNumber}</td>
      <td class="center">${it.installmentNumber}</td>
      <td class="right">${fmt(it.amount)}</td>
    </tr>`).join('')

  const newRows = data.newItems.map(it => `
    <tr>
      <td class="center">${it.installmentNumber}</td>
      <td class="right">${fmt(it.amount)}</td>
      <td class="center">${fmtDate(it.dueDate)}</td>
    </tr>`).join('')

  const inner = `
    ${companyHeader(company)}
    <div style="text-align:center;margin:18px 0 8px;">
      <span class="badge" style="background:#dbeafe;color:#2563eb;">COMPROVANTE DE RENEGOCIAÇÃO</span>
    </div>
    <table style="margin-bottom:14px;">
      <tr><td style="border:none;padding:3px 6px;" class="muted">Cliente</td><td style="border:none;padding:3px 6px;" class="right"><strong>${data.customerName}</strong></td></tr>
      ${data.customerDoc ? `<tr><td style="border:none;padding:3px 6px;" class="muted">CPF/CNPJ</td><td style="border:none;padding:3px 6px;" class="right">${data.customerDoc}</td></tr>` : ''}
      <tr><td style="border:none;padding:3px 6px;" class="muted">Data/Hora</td><td style="border:none;padding:3px 6px;" class="right">${data.dateTime}</td></tr>
      <tr><td style="border:none;padding:3px 6px;" class="muted">Ref. do Acordo</td><td style="border:none;padding:3px 6px;" class="right"><strong>${data.renegotiationRef}</strong></td></tr>
      ${data.paymentMethod ? `<tr><td style="border:none;padding:3px 6px;" class="muted">Forma de Pagamento (entrada)</td><td style="border:none;padding:3px 6px;" class="right">${data.paymentMethod}</td></tr>` : ''}
      ${data.cashAccount ? `<tr><td style="border:none;padding:3px 6px;" class="muted">Conta Caixa (entrada)</td><td style="border:none;padding:3px 6px;" class="right">${data.cashAccount}</td></tr>` : ''}
    </table>

    <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Parcelas renegociadas (baixadas)</div>
    <table>
      <thead><tr><th>Venda</th><th class="center">Parcela</th><th class="right">Valor</th></tr></thead>
      <tbody>${oldRows}</tbody>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:14px 0;">
      <div style="padding:10px;background:#f1f5f9;border-radius:8px;text-align:center;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Saldo Original</div>
        <div style="font-weight:700;">${fmt(data.originalTotal)}</div>
      </div>
      <div style="padding:10px;background:#ecfeff;border-radius:8px;text-align:center;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Entrada</div>
        <div style="font-weight:700;color:#0891b2;">${fmt(data.entryAmount)}</div>
      </div>
      <div style="padding:10px;background:#eff6ff;border-radius:8px;text-align:center;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Novo Saldo</div>
        <div style="font-weight:700;color:#2563eb;">${fmt(data.newBalance)}</div>
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Novas parcelas</div>
    <table>
      <thead><tr><th class="center">Nº</th><th class="right">Valor</th><th class="center">Vencimento</th></tr></thead>
      <tbody>${newRows}</tbody>
    </table>
    ${data.notes ? `<div style="margin-top:12px;font-size:12px;color:#64748b;"><strong>Observações:</strong> ${data.notes}</div>` : ''}
    <div style="margin-top:24px;display:flex;justify-content:space-between;gap:16px;">
      <div style="flex:1;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;font-size:11px;color:#64748b;">Assinatura do Cliente</div>
      <div style="flex:1;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;font-size:11px;color:#64748b;">Assinatura da Loja</div>
    </div>
    <div style="margin-top:18px;text-align:center;font-size:11px;color:#94a3b8;">Documento gerado eletronicamente • ${data.dateTime}</div>`
  return wrapDocument('Comprovante de Renegociação', inner)
}

export function printReceiptHTML(html: string) {
  const win = window.open('', '_blank', 'width=640,height=800')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
