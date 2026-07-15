export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateNextSku } from '@/lib/sku';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? 'Sistema';
    const body = await request.json();
    const { type, rows, duplicateAction, fileName } = body;
    // type: clientes|produtos|estoque
    // rows: validated data rows
    // duplicateAction: 'ignorar'|'atualizar'
    // fileName: original file name

    if (!type || !rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errorCount = 0;
    const errorDetails: { row: number; message: string }[] = [];

    if (type === 'clientes') {
      // Load existing for duplicate matching
      const existing = await prisma.customer.findMany({
        where: { companyId, isActive: true },
        select: { id: true, phone: true, whatsapp: true, email: true, cpfCnpj: true },
      });
      const phoneMap: Map<string, string> = new Map(existing.filter(c => c.phone).map(c => [c.phone!.replace(/\D/g, ''), c.id]));
      const emailMap: Map<string, string> = new Map(existing.filter(c => c.email).map(c => [c.email!.toLowerCase(), c.id]));
      const cpfMap: Map<string, string> = new Map(existing.filter(c => c.cpfCnpj).map(c => [c.cpfCnpj!.replace(/\D/g, ''), c.id]));

      for (const r of rows) {
        try {
          const phone = r.telefone?.replace(/\D/g, '') || '';
          const email = r.email?.toLowerCase().trim() || '';
          const cpf = r.cpfCnpj?.replace(/\D/g, '') || '';

          let existingId = '';
          if (cpf) existingId = cpfMap.get(cpf) ?? '';
          if (!existingId && email) existingId = emailMap.get(email) ?? '';
          if (!existingId && phone) existingId = phoneMap.get(phone) ?? '';

          const data: any = {
            name: r.nome?.trim(),
            phone: r.telefone?.trim() || null,
            whatsapp: r.whatsapp?.trim() || r.telefone?.trim() || null,
            email: r.email?.trim() || null,
            cpfCnpj: r.cpfCnpj?.trim() || null,
            city: r.cidade?.trim() || null,
            state: r.estado?.trim() || null,
            type: r.tipo?.toLowerCase().trim() || 'varejo',
            tags: r.etiquetas ? r.etiquetas.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          };

          if (existingId) {
            if (duplicateAction === 'atualizar') {
              await prisma.customer.update({ where: { id: existingId }, data });
              updated++;
            } else {
              skipped++;
            }
          } else {
            await prisma.customer.create({ data: { ...data, companyId } });
            imported++;
          }
        } catch (e: any) {
          errorCount++;
          errorDetails.push({ row: r._row ?? 0, message: e.message?.slice(0, 100) ?? 'Erro desconhecido' });
        }
      }
    } else if (type === 'produtos') {
      // Load existing for duplicate matching
      const existing = await prisma.product.findMany({
        where: { companyId, isActive: true },
        select: { id: true, sku: true, barcode: true },
      });
      const skuMap: Map<string, string> = new Map(existing.filter(p => p.sku).map(p => [p.sku!.toLowerCase(), p.id]));
      const barcodeMap: Map<string, string> = new Map(existing.filter(p => p.barcode).map(p => [p.barcode!, p.id]));

      // Pre-load/create categories
      const categories = await prisma.category.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true } });
      const catMap: Map<string, string> = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

      for (const r of rows) {
        try {
          let existingId = '';
          const sku = r.sku?.trim().toLowerCase() || '';
          if (sku) existingId = skuMap.get(sku) ?? '';
          if (!existingId && r.codigoBarras) existingId = barcodeMap.get(r.codigoBarras.trim()) ?? '';

          // Resolve category
          let categoryId: string | null = r._categoryId ?? null;
          if (!categoryId && r.categoria?.trim()) {
            const catName = r.categoria.trim();
            categoryId = catMap.get(catName.toLowerCase()) ?? null;
            if (!categoryId) {
              const newCat = await prisma.category.create({ data: { name: catName, companyId } });
              categoryId = newCat.id;
              catMap.set(catName.toLowerCase(), newCat.id);
            }
          }

          const cost = parseFloat(r.custo) || 0;
          const sale = parseFloat(r.precoVenda) || 0;
          const margin = sale > 0 && cost > 0 ? +((1 - cost / sale) * 100).toFixed(1) : 0;

          // Auto-gerar SKU se não fornecido (apenas para novos produtos)
          const importedSku = r.sku?.trim() || null;

          const data: any = {
            name: r.nome?.trim(),
            sku: importedSku,
            barcode: r.codigoBarras?.trim() || null,
            description: r.descricao?.trim() || null,
            costPrice: cost,
            salePrice: sale,
            margin,
            stockQuantity: parseInt(r.estoque) || 0,
            minStock: r.estoqueMinimo !== undefined && r.estoqueMinimo !== '' ? parseInt(r.estoqueMinimo) : 0,
            categoryId,
            isActive: r.status?.toLowerCase() === 'inativo' ? false : true,
          };

          if (existingId) {
            if (duplicateAction === 'atualizar') {
              await prisma.product.update({ where: { id: existingId }, data });
              updated++;
            } else {
              skipped++;
            }
          } else {
            // Gerar SKU automático se não informado
            if (!data.sku) {
              data.sku = await generateNextSku(companyId);
            }
            await prisma.product.create({ data: { ...data, companyId } });
            imported++;
          }
        } catch (e: any) {
          errorCount++;
          errorDetails.push({ row: r._row ?? 0, message: e.message?.slice(0, 100) ?? 'Erro desconhecido' });
        }
      }
    } else if (type === 'estoque') {
      // Stock import — creates inventory movements as "Ajuste Inicial"
      for (const r of rows) {
        try {
          const productId = r._productId;
          const qty = r._quantity;
          if (!productId || qty == null) {
            skipped++;
            continue;
          }

          // Update product stock directly
          await prisma.product.update({
            where: { id: productId },
            data: { stockQuantity: qty },
          });

          // Register inventory movement
          await prisma.inventoryMovement.create({
            data: {
              productId,
              companyId,
              type: 'ajuste',
              quantity: qty,
              reason: 'Ajuste Inicial de Estoque — Importação',
              reference: `Importação ${fileName ?? 'arquivo'} | Usuário: ${userName}`,
            },
          });

          imported++;
        } catch (e: any) {
          errorCount++;
          errorDetails.push({ row: r._row ?? 0, message: e.message?.slice(0, 100) ?? 'Erro desconhecido' });
        }
      }
    } else {
      return NextResponse.json({ error: 'Tipo de importação inválido' }, { status: 400 });
    }

    // Save import log
    await prisma.importLog.create({
      data: {
        companyId,
        type,
        fileName: fileName ?? 'arquivo.xlsx',
        totalRows: rows.length,
        imported,
        updated,
        errors: errorCount,
        skipped,
        errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 100) : undefined,
        importedById: userId,
        importedByName: userName,
      },
    });

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      errors: errorCount,
      errorDetails: errorDetails.slice(0, 20),
    });
  } catch (error: any) {
    console.error('POST /api/importacao/executar error:', error);
    return NextResponse.json({ error: 'Erro na importação' }, { status: 500 });
  }
}
