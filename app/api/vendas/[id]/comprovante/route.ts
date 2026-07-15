export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { formatSaleNumber } from '@/lib/sale-number';
import puppeteer from 'puppeteer';

const DEFAULT_AGRADECIMENTO = `Obrigado pela sua compra, {cliente} ❤️\n\nSeu pedido #{pedido} foi finalizado com sucesso.\n\nVendedor responsável: {vendedor}\nTotal: {total}\n\n{empresa}`;

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  // Convert \n to <br>
  result = result.replace(/\\n/g, '<br>');
  return result;
}

function statusLabel(status: string): { text: string; color: string; bg: string } {
  switch (status) {
    case 'concluida': return { text: 'PAGO', color: '#059669', bg: '#d1fae5' };
    case 'orcamento': return { text: 'ORÇAMENTO', color: '#2563eb', bg: '#dbeafe' };
    case 'parcial': return { text: 'PARCIAL', color: '#d97706', bg: '#fef3c7' };
    case 'pendente': return { text: 'PENDENTE', color: '#dc2626', bg: '#fee2e2' };
    case 'cancelada': return { text: 'CANCELADA', color: '#6b7280', bg: '#f3f4f6' };
    default: return { text: status.toUpperCase(), color: '#6b7280', bg: '#f3f4f6' };
  }
}

function buildReceiptHTML(sale: any, company: any, messageContent: string): string {
  const status = statusLabel(sale.status);
  const vars = {
    cliente: sale.customer?.name || 'Cliente',
    pedido: formatSaleNumber(sale.companySaleNumber, sale.saleNumber),
    total: fmt(sale.total),
    vendedor: sale.seller?.name || '—',
    empresa: company.name,
  };
  const footerMessage = replaceVars(messageContent, vars);

  const logoSection = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : `<div style="width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#1e40af,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:22px;">${company.name.charAt(0)}</div>`;

  const socialLinks: string[] = [];
  if (company.whatsapp) socialLinks.push(`<span style="color:#6b7280;">📱 ${company.whatsapp}</span>`);
  if (company.instagram) socialLinks.push(`<span style="color:#6b7280;">📸 @${company.instagram.replace('@', '')}</span>`);
  if (company.phone && company.phone !== company.whatsapp) socialLinks.push(`<span style="color:#6b7280;">📞 ${company.phone}</span>`);

  const itemRows = (sale.items || []).map((item: any) => {
    const prodName = item.product?.name || 'Produto';
    const variation = item.variation
      ? [item.variation.color, item.variation.size].filter(Boolean).join(' / ')
      : '';
    const subtotalItem = (item.unitPrice * item.quantity) - (item.discount || 0);
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          <div style="font-weight:500;color:#1e293b;">${prodName}</div>
          ${variation ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">${variation}</div>` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b;font-family:'Inter',sans-serif;">${fmt(item.unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:#1e293b;font-family:'Inter',sans-serif;">${fmt(subtotalItem)}</td>
      </tr>
    `;
  }).join('');

  const paymentRows = (sale.payments && sale.payments.length > 0)
    ? sale.payments.map((p: any) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="color:#64748b;">${p.paymentMethod?.name || 'Pagamento'}</span>
          <span style="font-weight:600;color:#1e293b;font-family:'Inter',sans-serif;">${fmt(p.amount)}</span>
        </div>
      `).join('')
    : `<div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#64748b;">${sale.paymentMethod || 'Dinheiro'}</span>
        <span style="font-weight:600;color:#1e293b;font-family:'Inter',sans-serif;">${fmt(sale.total)}</span>
      </div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', 'Inter', -apple-system, sans-serif;
      color: #1e293b;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 32px;
    }
    .num { font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logoSection}
        <div>
          <div style="font-size:20px;font-weight:700;color:#1e293b;">${company.name}</div>
          ${company.phone ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">📞 ${company.phone}</div>` : ''}
          ${company.whatsapp ? `<div style="font-size:12px;color:#94a3b8;">📱 WhatsApp: ${company.whatsapp}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${sale.status === 'orcamento' ? 'Orçamento' : 'Comprovante de Venda'}</div>
        <div class="num" style="font-size:22px;font-weight:800;color:#1e40af;margin-top:4px;">#${formatSaleNumber(sale.companySaleNumber, sale.saleNumber)}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${fmtDateTime(sale.createdAt)}</div>
      </div>
    </div>

    <!-- CLIENT + SELLER -->
    <div style="display:flex;gap:20px;margin-top:24px;">
      <div style="flex:1;background:#f8fafc;border-radius:12px;padding:16px;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:8px;">Cliente</div>
        <div style="font-weight:600;color:#1e293b;">${sale.customer?.name || 'Consumidor Final'}</div>
        ${sale.customer?.phone ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">📞 ${sale.customer.phone}</div>` : ''}
        ${sale.customer?.city ? `<div style="font-size:13px;color:#64748b;margin-top:2px;">📍 ${sale.customer.city}${sale.customer.state ? ' / ' + sale.customer.state : ''}</div>` : ''}
      </div>
      <div style="flex:1;background:#f8fafc;border-radius:12px;padding:16px;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:8px;">Vendedor</div>
        <div style="font-weight:600;color:#1e293b;">${sale.seller?.name || '—'}</div>
      </div>
    </div>

    <!-- PRODUCTS TABLE -->
    <div style="margin-top:24px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:12px;">Produtos</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-radius:8px 0 0 8px;">Produto</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Qtd</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Unit.</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-radius:0 8px 8px 0;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- FINANCIAL SUMMARY -->
    <div style="margin-top:24px;background:#f8fafc;border-radius:12px;padding:20px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#64748b;">Subtotal</span>
        <span class="num" style="color:#1e293b;">${fmt(sale.subtotal || sale.total + (sale.discount || 0))}</span>
      </div>
      ${sale.discount > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#dc2626;">Desconto</span>
        <span class="num" style="color:#dc2626;font-weight:600;">- ${fmt(sale.discount)}</span>
      </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 0 0;margin-top:8px;border-top:2px solid #e2e8f0;">
        <span style="font-size:16px;font-weight:700;color:#1e293b;">Total</span>
        <span class="num" style="font-size:20px;font-weight:800;color:#059669;">${fmt(sale.total)}</span>
      </div>
    </div>

    <!-- PAYMENT METHODS -->
    <div style="margin-top:24px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:12px;">Formas de Pagamento</div>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;">
        ${paymentRows}
      </div>
    </div>

    <!-- STATUS -->
    <div style="margin-top:24px;text-align:center;">
      <span style="display:inline-block;padding:8px 24px;border-radius:100px;background:${status.bg};color:${status.color};font-weight:700;font-size:13px;letter-spacing:0.5px;">
        ${status.text}
      </span>
    </div>

    ${sale.notes ? `
    <!-- OBSERVATIONS -->
    <div style="margin-top:24px;background:#fffbeb;border-radius:12px;padding:16px;border:1px solid #fef3c7;">
      <div style="font-size:11px;color:#d97706;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:8px;">Observações</div>
      <div style="font-size:13px;color:#92400e;">${sale.notes}</div>
    </div>
    ` : ''}

    <!-- FOOTER -->
    <div style="margin-top:32px;padding-top:24px;border-top:2px solid #e2e8f0;text-align:center;">
      <div style="font-size:14px;color:#64748b;line-height:1.6;">${footerMessage}</div>
      ${socialLinks.length > 0 ? `
      <div style="margin-top:16px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
        ${socialLinks.join('')}
      </div>
      ` : ''}
      <div style="margin-top:20px;font-size:10px;color:#cbd5e1;">Documento gerado em ${fmtDateTime(new Date())} • PushSisten</div>
    </div>
  </div>
</body>
</html>
`;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = session.user.companyId;
    const sale = await prisma.sale.findFirst({
      where: { id: params?.id, companyId },
      include: {
        customer: { select: { id: true, name: true, phone: true, whatsapp: true, city: true, state: true } },
        seller: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variation: { select: { id: true, color: true, size: true } },
          },
        },
        payments: {
          include: {
            paymentMethod: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });
    if (!sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    const company = await prisma.company.findUnique({
      where: { id: sale.companyId },
      select: { name: true, phone: true, whatsapp: true, instagram: true, logoUrl: true, city: true, state: true },
    });
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    // Get thank-you message
    const template = await prisma.messageTemplate.findFirst({
      where: { companyId: sale.companyId, type: 'agradecimento', isActive: true },
    });
    const messageContent = template?.content || DEFAULT_AGRADECIMENTO;

    const html = buildReceiptHTML(sale, company, messageContent);

    // Generate PDF locally using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true,
      });
      await browser.close();

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${sale.status === 'orcamento' ? 'orcamento' : 'comprovante'}-${formatSaleNumber(sale.companySaleNumber, sale.saleNumber)}.pdf"`,
        },
      });
    } catch (pdfError: any) {
      console.error('PDF generation error:', pdfError);
      if (browser) await browser.close();
      return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('GET /api/vendas/[id]/comprovante error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
