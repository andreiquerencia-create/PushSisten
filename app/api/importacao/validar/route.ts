export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();
    const { type, rows } = body; // type: clientes|produtos|estoque, rows: mapped data[]

    if (!type || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const errors: { row: number; field: string; message: string }[] = [];
    const duplicates: { row: number; field: string; value: string; existingId?: string }[] = [];
    const valid: any[] = [];

    if (type === 'clientes') {
      // Load existing for duplicate check
      const existing = await prisma.customer.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, phone: true, whatsapp: true, email: true, cpfCnpj: true },
      });
      const phoneSet = new Set(existing.filter(c => c.phone).map(c => c.phone!.replace(/\D/g, '')));
      const whatsSet = new Set(existing.filter(c => c.whatsapp).map(c => c.whatsapp!.replace(/\D/g, '')));
      const emailSet = new Set(existing.filter(c => c.email).map(c => c.email!.toLowerCase()));
      const cpfSet = new Set(existing.filter(c => c.cpfCnpj).map(c => c.cpfCnpj!.replace(/\D/g, '')));

      const seenPhones = new Set<string>();
      const seenEmails = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;
        let hasError = false;

        if (!r.nome?.trim()) {
          errors.push({ row: rowNum, field: 'nome', message: 'Nome é obrigatório' });
          hasError = true;
        }

        const phone = r.telefone?.replace(/\D/g, '') || '';
        const whats = r.whatsapp?.replace(/\D/g, '') || '';
        const email = r.email?.toLowerCase().trim() || '';
        const cpf = r.cpfCnpj?.replace(/\D/g, '') || '';

        if (phone && phoneSet.has(phone)) {
          duplicates.push({ row: rowNum, field: 'telefone', value: r.telefone });
        }
        if (phone && seenPhones.has(phone)) {
          duplicates.push({ row: rowNum, field: 'telefone', value: `${r.telefone} (duplicado no arquivo)` });
        }
        if (phone) seenPhones.add(phone);

        if (whats && whatsSet.has(whats)) {
          duplicates.push({ row: rowNum, field: 'whatsapp', value: r.whatsapp });
        }

        if (email && emailSet.has(email)) {
          duplicates.push({ row: rowNum, field: 'email', value: r.email });
        }
        if (email && seenEmails.has(email)) {
          duplicates.push({ row: rowNum, field: 'email', value: `${r.email} (duplicado no arquivo)` });
        }
        if (email) seenEmails.add(email);

        if (cpf && cpfSet.has(cpf)) {
          duplicates.push({ row: rowNum, field: 'cpfCnpj', value: r.cpfCnpj });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ row: rowNum, field: 'email', message: 'Email inválido' });
          hasError = true;
        }

        if (!hasError) valid.push({ ...r, _row: rowNum });
      }
    } else if (type === 'produtos') {
      const existing = await prisma.product.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, sku: true, barcode: true },
      });
      const skuSet = new Set(existing.filter(p => p.sku).map(p => p.sku!.toLowerCase()));
      const barcodeSet = new Set(existing.filter(p => p.barcode).map(p => p.barcode!));
      const seenSkus = new Set<string>();

      const categories = await prisma.category.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true } });
      const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;
        let hasError = false;

        if (!r.nome?.trim()) {
          errors.push({ row: rowNum, field: 'nome', message: 'Nome do produto é obrigatório' });
          hasError = true;
        }

        const sku = r.sku?.trim().toLowerCase() || '';
        if (sku && skuSet.has(sku)) {
          duplicates.push({ row: rowNum, field: 'sku', value: r.sku });
        }
        if (sku && seenSkus.has(sku)) {
          duplicates.push({ row: rowNum, field: 'sku', value: `${r.sku} (duplicado no arquivo)` });
        }
        if (sku) seenSkus.add(sku);

        if (r.codigoBarras && barcodeSet.has(r.codigoBarras)) {
          duplicates.push({ row: rowNum, field: 'codigoBarras', value: r.codigoBarras });
        }

        if (r.custo && isNaN(parseFloat(r.custo))) {
          errors.push({ row: rowNum, field: 'custo', message: 'Custo inválido' });
          hasError = true;
        }
        if (r.precoVenda && isNaN(parseFloat(r.precoVenda))) {
          errors.push({ row: rowNum, field: 'precoVenda', message: 'Preço inválido' });
          hasError = true;
        }

        if (!hasError) {
          valid.push({ ...r, _row: rowNum, _categoryId: r.categoria ? catMap.get(r.categoria.toLowerCase()) : undefined });
        }
      }
    } else if (type === 'estoque') {
      const products = await prisma.product.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, sku: true, barcode: true },
      });
      const skuMap: Map<string, string> = new Map(products.filter(p => p.sku).map(p => [p.sku!.toLowerCase(), p.id]));
      const barcodeMap: Map<string, string> = new Map(products.filter(p => p.barcode).map(p => [p.barcode!, p.id]));
      const nameMap: Map<string, string> = new Map(products.map(p => [p.name.toLowerCase(), p.id]));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;

        let productId = '';
        if (r.sku) productId = skuMap.get(r.sku.toLowerCase()) ?? '';
        if (!productId && r.codigoBarras) productId = barcodeMap.get(r.codigoBarras) ?? '';
        if (!productId && r.nomeProduto) productId = nameMap.get(r.nomeProduto.toLowerCase()) ?? '';

        if (!productId) {
          errors.push({ row: rowNum, field: 'produto', message: `Produto não encontrado: ${r.sku || r.codigoBarras || r.nomeProduto || '(vazio)'}` });
          continue;
        }

        const qty = parseInt(r.quantidade);
        if (isNaN(qty) || qty < 0) {
          errors.push({ row: rowNum, field: 'quantidade', message: 'Quantidade inválida' });
          continue;
        }

        valid.push({ ...r, _row: rowNum, _productId: productId, _quantity: qty });
      }
    }

    return NextResponse.json({
      totalRows: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
      duplicateCount: duplicates.length,
      errors: errors.slice(0, 50),
      duplicates: duplicates.slice(0, 50),
      valid,
    });
  } catch (error: any) {
    console.error('POST /api/importacao/validar error:', error);
    return NextResponse.json({ error: 'Erro ao validar dados' }, { status: 500 });
  }
}
