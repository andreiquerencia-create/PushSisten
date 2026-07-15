import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Company
  const company = await prisma.company.upsert({
    where: { cnpj: '12.345.678/0001-90' },
    update: {},
    create: {
      name: 'Querência Atacado',
      cnpj: '12.345.678/0001-90',
      email: 'querencia@gmail.com',
      phone: '(51) 99999-0000',
      address: 'Rua das Roupas, 100 - Centro',
      city: 'Porto Alegre',
      state: 'RS',
    },
  });
  console.log('Company created:', company.name);

  // 2. Users
  const adminPass = await bcrypt.hash('admin123', 12);
  const gerentePass = await bcrypt.hash('gerente123', 12);
  const vendedorPass = await bcrypt.hash('vendedor123', 12);
  const masterPass = await bcrypt.hash('master123', 12);
  const testPass = await bcrypt.hash('johndoe123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pushsisten.com' },
    update: {},
    create: { name: 'Carlos Admin', email: 'admin@pushsisten.com', password: adminPass, role: 'administrador', companyId: company.id },
  });

  const gerente = await prisma.user.upsert({
    where: { email: 'gerente@pushsisten.com' },
    update: {},
    create: { name: 'Maria Gerente', email: 'gerente@pushsisten.com', password: gerentePass, role: 'gerente', companyId: company.id },
  });

  const vendedor1 = await prisma.user.upsert({
    where: { email: 'vendedor@pushsisten.com' },
    update: {},
    create: { name: 'Ana Vendedora', email: 'vendedor@pushsisten.com', password: vendedorPass, role: 'vendedor', companyId: company.id },
  });

  const vendedor2 = await prisma.user.upsert({
    where: { email: 'pedro@pushsisten.com' },
    update: {},
    create: { name: 'Pedro Vendedor', email: 'pedro@pushsisten.com', password: vendedorPass, role: 'vendedor', companyId: company.id },
  });

  const master = await prisma.user.upsert({
    where: { email: 'master@pushsisten.com' },
    update: {},
    create: { name: 'Super Admin', email: 'master@pushsisten.com', password: masterPass, role: 'administrador', isMaster: true, companyId: company.id },
  });

  // Test user (required)
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: { name: 'John Test', email: 'john@doe.com', password: testPass, role: 'administrador', companyId: company.id },
  });

  console.log('Users created');

  // 3. Categories
  const categoryNames = [
    'Calças', 'Blusas', 'Vestidos', 'Saias', 'Shorts', 'Jaquetas', 'Camisetas',
    'Moletons', 'Conjuntos', 'Lingerie', 'Acessórios', 'Bermudas', 'Macacões', 'Croppeds', 'Regatas'
  ];
  const categories: any[] = [];
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { id: `cat-${name.toLowerCase().replace(/[^a-z]/g, '')}` },
      update: {},
      create: { id: `cat-${name.toLowerCase().replace(/[^a-z]/g, '')}`, name, companyId: company.id },
    });
    categories.push(cat);
  }
  console.log('Categories created:', categories.length);

  // 4. Products
  const productsData = [
    { name: 'Calça Jeans Skinny', sku: 'CJ-001', costPrice: 35, salePrice: 69.90, stock: 80, min: 15, cat: 'cal\u00e7as' },
    { name: 'Calça Jeans Mom', sku: 'CJ-002', costPrice: 38, salePrice: 74.90, stock: 60, min: 10, cat: 'cal\u00e7as' },
    { name: 'Calça Legging Lisa', sku: 'CL-001', costPrice: 12, salePrice: 29.90, stock: 120, min: 20, cat: 'cal\u00e7as' },
    { name: 'Blusa Viscose Estampada', sku: 'BV-001', costPrice: 18, salePrice: 39.90, stock: 90, min: 15, cat: 'blusas' },
    { name: 'Blusa Crepe Social', sku: 'BC-001', costPrice: 22, salePrice: 49.90, stock: 45, min: 10, cat: 'blusas' },
    { name: 'Vestido Midi Floral', sku: 'VM-001', costPrice: 32, salePrice: 79.90, stock: 35, min: 8, cat: 'vestidos' },
    { name: 'Vestido Longo Estampado', sku: 'VL-001', costPrice: 45, salePrice: 99.90, stock: 25, min: 5, cat: 'vestidos' },
    { name: 'Saia Midi Plissada', sku: 'SM-001', costPrice: 25, salePrice: 54.90, stock: 40, min: 8, cat: 'saias' },
    { name: 'Short Jeans Desfiado', sku: 'SJ-001', costPrice: 20, salePrice: 44.90, stock: 70, min: 15, cat: 'shorts' },
    { name: 'Short Alfaiataria', sku: 'SA-001', costPrice: 28, salePrice: 59.90, stock: 30, min: 8, cat: 'shorts' },
    { name: 'Jaqueta Jeans Oversize', sku: 'JJ-001', costPrice: 55, salePrice: 119.90, stock: 20, min: 5, cat: 'jaquetas' },
    { name: 'Jaqueta Corta-Vento', sku: 'JC-001', costPrice: 35, salePrice: 79.90, stock: 4, min: 5, cat: 'jaquetas' },
    { name: 'Camiseta Básica Algodão', sku: 'CB-001', costPrice: 8, salePrice: 19.90, stock: 200, min: 30, cat: 'camisetas' },
    { name: 'Camiseta Oversized', sku: 'CO-001', costPrice: 12, salePrice: 29.90, stock: 150, min: 25, cat: 'camisetas' },
    { name: 'Moletom Canguru', sku: 'MC-001', costPrice: 40, salePrice: 89.90, stock: 35, min: 8, cat: 'moletons' },
    { name: 'Moletom Cropped', sku: 'MC-002', costPrice: 30, salePrice: 69.90, stock: 25, min: 5, cat: 'moletons' },
    { name: 'Conjunto Moletom P&B', sku: 'CM-001', costPrice: 55, salePrice: 129.90, stock: 15, min: 5, cat: 'conjuntos' },
    { name: 'Conjunto Fitness', sku: 'CF-001', costPrice: 28, salePrice: 64.90, stock: 50, min: 10, cat: 'conjuntos' },
    { name: 'Calcinha Básica Kit 3', sku: 'LG-001', costPrice: 10, salePrice: 24.90, stock: 100, min: 20, cat: 'lingerie' },
    { name: 'Sutiã Push Up', sku: 'LG-002', costPrice: 18, salePrice: 39.90, stock: 60, min: 10, cat: 'lingerie' },
    { name: 'Bolsa Tiracolo', sku: 'AC-001', costPrice: 25, salePrice: 59.90, stock: 30, min: 5, cat: 'acessrios' },
    { name: 'Cinto Couro Sintético', sku: 'AC-002', costPrice: 8, salePrice: 19.90, stock: 50, min: 10, cat: 'acessrios' },
    { name: 'Bermuda Ciclista', sku: 'BC-002', costPrice: 10, salePrice: 24.90, stock: 80, min: 15, cat: 'bermudas' },
    { name: 'Macacão Longo Viscolycra', sku: 'ML-001', costPrice: 35, salePrice: 84.90, stock: 20, min: 5, cat: 'macaces' },
    { name: 'Macacão Curto Estampado', sku: 'MC-003', costPrice: 28, salePrice: 64.90, stock: 25, min: 5, cat: 'macaces' },
    { name: 'Cropped Canelado', sku: 'CR-001', costPrice: 10, salePrice: 24.90, stock: 90, min: 15, cat: 'croppeds' },
    { name: 'Cropped Tricot', sku: 'CR-002', costPrice: 18, salePrice: 39.90, stock: 3, min: 10, cat: 'croppeds' },
    { name: 'Regata Fitness', sku: 'RF-001', costPrice: 8, salePrice: 22.90, stock: 100, min: 20, cat: 'regatas' },
    { name: 'Regata Canelada Básica', sku: 'RC-001', costPrice: 7, salePrice: 18.90, stock: 120, min: 25, cat: 'regatas' },
    { name: 'Calça Pantalona', sku: 'CP-001', costPrice: 30, salePrice: 69.90, stock: 2, min: 8, cat: 'cal\u00e7as' },
  ];

  const productRecords: any[] = [];
  for (const p of productsData) {
    const catId = categories.find((c: any) => c.id === `cat-${p.cat}`)?.id ?? null;
    const margin = p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice) * 100 : 0;
    const prod = await prisma.product.upsert({
      where: { id: `prod-${p.sku}` },
      update: {},
      create: {
        id: `prod-${p.sku}`,
        name: p.name,
        sku: p.sku,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        margin,
        stockQuantity: p.stock,
        minStock: p.min,
        categoryId: catId,
        companyId: company.id,
      },
    });
    productRecords.push(prod);
  }
  console.log('Products created:', productRecords.length);

  // 4b. Product Variations (for clothing items that have sizes/colors)
  const variationProducts = [
    { sku: 'CJ-001', colors: ['Azul Escuro', 'Preto', 'Azul Claro'], sizes: ['P', 'M', 'G', 'GG'] },
    { sku: 'CJ-002', colors: ['Azul', 'Preto'], sizes: ['P', 'M', 'G', 'GG'] },
    { sku: 'BV-001', colors: ['Floral Rosa', 'Floral Azul', 'Verde'], sizes: ['P', 'M', 'G'] },
    { sku: 'CB-001', colors: ['Preto', 'Branco', 'Cinza', 'Azul Marinho'], sizes: ['PP', 'P', 'M', 'G', 'GG', 'XG'] },
    { sku: 'CO-001', colors: ['Preto', 'Branco', 'Bege'], sizes: ['M', 'G', 'GG'] },
    { sku: 'MC-001', colors: ['Preto', 'Cinza', 'Verde Militar'], sizes: ['P', 'M', 'G', 'GG'] },
    { sku: 'CM-001', colors: ['Preto', 'Cinza'], sizes: ['P', 'M', 'G'] },
    { sku: 'CR-001', colors: ['Preto', 'Branco', 'Rosa', 'Bege'], sizes: ['PP', 'P', 'M', 'G'] },
  ];

  let totalVarsCreated = 0;
  for (const vp of variationProducts) {
    const product = productRecords.find((p: any) => p.sku === vp.sku);
    if (!product) continue;
    const baseStock = Math.max(1, Math.floor(product.stockQuantity / (vp.colors.length * vp.sizes.length)));
    let totalVariationStock = 0;
    for (const color of vp.colors) {
      for (const size of vp.sizes) {
        const varId = `var-${vp.sku}-${color.replace(/\\s/g, '')}-${size}`;
        const stock = baseStock + Math.floor(Math.random() * 5);
        totalVariationStock += stock;
        await prisma.productVariation.upsert({
          where: { id: varId },
          update: {},
          create: {
            id: varId,
            productId: product.id,
            color,
            size,
            sku: `${vp.sku}-${color.substring(0, 3).toUpperCase()}-${size}`,
            barcode: `789${vp.sku.replace('-', '')}${color.substring(0, 2).toUpperCase()}${size}`.replace(/\\s/g, ''),
            costPrice: product.costPrice,
            salePrice: product.salePrice,
            stockQuantity: stock,
            minStock: 3,
          },
        });
        totalVarsCreated++;
      }
    }
    // Update product total stock to match sum of variations
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: totalVariationStock },
    });
  }
  console.log('Product variations created:', totalVarsCreated);

  // 5. Customers
  const customersData = [
    { name: 'Loja Bella Moda', email: 'bella@email.com', phone: '(51) 98888-1111', city: 'Porto Alegre', state: 'RS', type: 'lojista', tags: ['VIP', 'recorrente'] },
    { name: 'Revenda Fashion', email: 'fashion@email.com', phone: '(51) 98888-2222', city: 'Canoas', state: 'RS', type: 'revendedor', tags: ['recorrente'] },
    { name: 'Boutique Charme', email: 'charme@email.com', phone: '(51) 98888-3333', city: 'Caxias do Sul', state: 'RS', type: 'lojista', tags: ['VIP'] },
    { name: 'Maria Silva', email: 'maria@email.com', phone: '(51) 98888-4444', city: 'Porto Alegre', state: 'RS', type: 'varejo', tags: [] },
    { name: 'Loja Estrela', email: 'estrela@email.com', phone: '(51) 98888-5555', city: 'Pelotas', state: 'RS', type: 'lojista', tags: ['recorrente'] },
    { name: 'Ana Costa', email: 'ana.costa@email.com', phone: '(51) 98888-6666', city: 'Novo Hamburgo', state: 'RS', type: 'varejo', tags: [] },
    { name: 'Atacado Mineiro', email: 'mineiro@email.com', phone: '(31) 98888-7777', city: 'Belo Horizonte', state: 'MG', type: 'atacado', tags: ['VIP', 'recorrente'] },
    { name: 'Patricia Lopes', email: 'patricia@email.com', phone: '(11) 98888-8888', city: 'São Paulo', state: 'SP', type: 'revendedor', tags: [] },
    { name: 'Loja Tendencia', email: 'tendencia@email.com', phone: '(51) 98888-9999', city: 'Santa Maria', state: 'RS', type: 'lojista', tags: ['inadimplente'] },
    { name: 'Fernanda Reis', email: 'fernanda@email.com', phone: '(51) 97777-1111', city: 'Gravaí', state: 'RS', type: 'varejo', tags: ['inativo'] },
    { name: 'Atacado Sul Moda', email: 'sulmoda@email.com', phone: '(51) 97777-2222', city: 'Porto Alegre', state: 'RS', type: 'atacado', tags: ['VIP'] },
    { name: 'Juliana Mendes', email: 'juliana@email.com', phone: '(51) 97777-3333', city: 'Cachoeirinha', state: 'RS', type: 'revendedor', tags: ['recorrente'] },
    { name: 'Loja da Gi', email: 'gi@email.com', phone: '(48) 97777-4444', city: 'Florianópolis', state: 'SC', type: 'lojista', tags: [] },
    { name: 'Roberto Santos', email: 'roberto@email.com', phone: '(51) 97777-5555', city: 'Porto Alegre', state: 'RS', type: 'varejo', tags: ['inativo'] },
    { name: 'Multimarcas Lux', email: 'lux@email.com', phone: '(41) 97777-6666', city: 'Curitiba', state: 'PR', type: 'lojista', tags: ['VIP', 'recorrente'] },
    { name: 'Camila Oliveira', email: 'camila@email.com', phone: '(51) 97777-7777', city: 'São Leopoldo', state: 'RS', type: 'varejo', tags: [] },
    { name: 'Moda Plus Size RS', email: 'plussize@email.com', phone: '(51) 97777-8888', city: 'Porto Alegre', state: 'RS', type: 'atacado', tags: ['recorrente'] },
    { name: 'Renata Vieira', email: 'renata@email.com', phone: '(51) 97777-9999', city: 'Esteio', state: 'RS', type: 'revendedor', tags: [] },
    { name: 'Bazar da Tia Zé', email: 'tiaze@email.com', phone: '(51) 96666-1111', city: 'Alvorada', state: 'RS', type: 'varejo', tags: ['inadimplente'] },
    { name: 'Loja Vitrine', email: 'vitrine@email.com', phone: '(51) 96666-2222', city: 'Sapucaia do Sul', state: 'RS', type: 'lojista', tags: [] },
  ];

  const customerRecords: any[] = [];
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { id: `cust-${c.email.split('@')[0]}` },
      update: {},
      create: {
        id: `cust-${c.email.split('@')[0]}`,
        name: c.name,
        email: c.email,
        phone: c.phone,
        whatsapp: c.phone,
        city: c.city,
        state: c.state,
        type: c.type,
        tags: c.tags,
        companyId: company.id,
      },
    });
    customerRecords.push(cust);
  }
  console.log('Customers created:', customerRecords.length);

  // 6. Financial Categories
  const finCategories = [
    { name: 'Vendas', type: 'entrada' },
    { name: 'Compras de Mercadoria', type: 'saida' },
    { name: 'Aluguel', type: 'saida' },
    { name: 'Salários', type: 'saida' },
    { name: 'Energia/Água', type: 'saida' },
    { name: 'Internet/Telefone', type: 'saida' },
    { name: 'Material de Escritório', type: 'saida' },
    { name: 'Outros', type: 'saida' },
  ];
  const finCatRecords: any[] = [];
  for (const fc of finCategories) {
    const fcat = await prisma.financialCategory.upsert({
      where: { id: `fincat-${fc.name.toLowerCase().replace(/[^a-z]/g, '')}` },
      update: {},
      create: {
        id: `fincat-${fc.name.toLowerCase().replace(/[^a-z]/g, '')}`,
        name: fc.name,
        type: fc.type,
        companyId: company.id,
      },
    });
    finCatRecords.push(fcat);
  }
  console.log('Financial categories created:', finCatRecords.length);

  // 7. Sales (50 sales over last 60 days)
  const sellers = [admin, gerente, vendedor1, vendedor2];
  const paymentMethods = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto'];
  const now = Date.now();

  // Check if sales already exist
  const existingSales = await prisma.sale.count({ where: { companyId: company.id } });
  if (existingSales < 10) {
    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const saleDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      const customer = customerRecords[Math.floor(Math.random() * customerRecords.length)];
      const seller = sellers[Math.floor(Math.random() * sellers.length)];
      const numItems = 1 + Math.floor(Math.random() * 4);
      const payment = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      const items: { productId: string; quantity: number; unitPrice: number; discount: number; total: number }[] = [];
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const product = productRecords[Math.floor(Math.random() * productRecords.length)];
        const quantity = 1 + Math.floor(Math.random() * 10);
        const unitPrice = product.salePrice;
        const itemDiscount = Math.random() < 0.2 ? Math.round(Math.random() * 10) : 0;
        const total = unitPrice * quantity - itemDiscount;
        subtotal += total;
        items.push({ productId: product.id, quantity, unitPrice, discount: itemDiscount, total });
      }

      const discount = Math.random() < 0.15 ? Math.round(Math.random() * 20) : 0;
      const total = subtotal - discount;

      const sale = await prisma.sale.create({
        data: {
          customerId: customer.id,
          sellerId: seller.id,
          companyId: company.id,
          subtotal,
          discount,
          total,
          paymentMethod: payment,
          status: Math.random() < 0.05 ? 'cancelada' : 'concluida',
          createdAt: saleDate,
          items: { create: items },
        },
      });

      // Inventory movements for sale items
      for (const item of items) {
        await prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            companyId: company.id,
            type: 'saida',
            quantity: item.quantity,
            reason: 'Venda',
            reference: sale.id,
            createdAt: saleDate,
          },
        });
      }

      // Financial record for sale
      if (sale.status === 'concluida') {
        await prisma.financialRecord.create({
          data: {
            description: `Venda #${sale.saleNumber}`,
            amount: total,
            type: 'entrada',
            paymentMethod: payment,
            categoryId: finCatRecords[0].id,
            companyId: company.id,
            date: saleDate,
            createdAt: saleDate,
          },
        });
      }
    }
    console.log('Sales created: 50');

    // 8. Financial expenses
    const expenses = [
      { desc: 'Aluguel - Março', amount: 3500, catIdx: 2, daysAgo: 45 },
      { desc: 'Aluguel - Abril', amount: 3500, catIdx: 2, daysAgo: 15 },
      { desc: 'Salários - Março', amount: 8500, catIdx: 3, daysAgo: 40 },
      { desc: 'Salários - Abril', amount: 8500, catIdx: 3, daysAgo: 10 },
      { desc: 'Compra Fornecedor TextilSul', amount: 12000, catIdx: 1, daysAgo: 50 },
      { desc: 'Compra Fornecedor ModaBrasil', amount: 8500, catIdx: 1, daysAgo: 25 },
      { desc: 'Compra Fornecedor JeansFit', amount: 5000, catIdx: 1, daysAgo: 5 },
      { desc: 'Energia elétrica', amount: 450, catIdx: 4, daysAgo: 20 },
      { desc: 'Água', amount: 120, catIdx: 4, daysAgo: 20 },
      { desc: 'Internet e Telefone', amount: 280, catIdx: 5, daysAgo: 18 },
      { desc: 'Material de escritório', amount: 150, catIdx: 6, daysAgo: 30 },
      { desc: 'Manutenção do sistema', amount: 200, catIdx: 7, daysAgo: 7 },
    ];

    for (const exp of expenses) {
      await prisma.financialRecord.create({
        data: {
          description: exp.desc,
          amount: exp.amount,
          type: 'saida',
          paymentMethod: exp.amount > 3000 ? 'boleto' : 'pix',
          categoryId: finCatRecords[exp.catIdx]?.id ?? null,
          companyId: company.id,
          date: new Date(now - exp.daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }
    console.log('Financial expenses created');

    // 9. Update customer stats
    for (const cust of customerRecords) {
      const salesAgg = await prisma.sale.aggregate({
        where: { customerId: cust.id, status: 'concluida' },
        _sum: { total: true },
        _count: true,
      });
      const lastSale = await prisma.sale.findFirst({
        where: { customerId: cust.id, status: 'concluida' },
        orderBy: { createdAt: 'desc' },
      });
      const totalPurchased = salesAgg._sum?.total ?? 0;
      const purchaseCount = salesAgg._count ?? 0;
      await prisma.customer.update({
        where: { id: cust.id },
        data: {
          totalPurchased,
          purchaseCount,
          avgTicket: purchaseCount > 0 ? totalPurchased / purchaseCount : 0,
          lastPurchase: lastSale?.createdAt ?? null,
        },
      });
    }
    console.log('Customer stats updated');
  } else {
    console.log('Sales already exist, skipping...');
  }

  // ============================
  // PHASE 2: Suppliers, Carriers, Sellers, Accounts
  // ============================

  // Suppliers
  const suppliersData = [
    { name: 'Malhas Sul Têxtil', phone: '(51) 3333-1001', whatsapp: '(51) 99901-1001', email: 'vendas@malhassul.com.br', city: 'Caxias do Sul', state: 'RS', cnpj: '11.111.111/0001-01' },
    { name: 'Confecções Nordeste Fashion', phone: '(85) 3333-2002', whatsapp: '(85) 99902-2002', email: 'contato@nordestefashion.com.br', city: 'Fortaleza', state: 'CE', cnpj: '22.222.222/0001-02' },
    { name: 'Jeans Brasil Atacado', phone: '(11) 3333-3003', whatsapp: '(11) 99903-3003', email: 'pedidos@jeansbrasil.com.br', city: 'São Paulo', state: 'SP', cnpj: '33.333.333/0001-03' },
    { name: 'Têxtil Mineira Ltda', phone: '(31) 3333-4004', whatsapp: '(31) 99904-4004', email: 'vendas@textilmineira.com.br', city: 'Belo Horizonte', state: 'MG', cnpj: '44.444.444/0001-04' },
    { name: 'Moda Goiás Confecções', phone: '(62) 3333-5005', whatsapp: '(62) 99905-5005', email: 'comercial@modagoias.com.br', city: 'Goiânia', state: 'GO', cnpj: '55.555.555/0001-05' },
    { name: 'Tricot Premium RS', phone: '(54) 3333-6006', email: 'tricotpremium@email.com', city: 'Farroupilha', state: 'RS', cnpj: '66.666.666/0001-06' },
    { name: 'Lingerie Delicatta', phone: '(47) 3333-7007', email: 'pedidos@delicatta.com.br', city: 'Blumenau', state: 'SC', cnpj: '77.777.777/0001-07' },
    { name: 'Acessórios Fashion Mix', phone: '(21) 3333-8008', email: 'mix@fashionmix.com.br', city: 'Rio de Janeiro', state: 'RJ', cnpj: '88.888.888/0001-08' },
    { name: 'Sportswear Brasil', phone: '(41) 3333-9009', email: 'vendas@sportwearbr.com.br', city: 'Curitiba', state: 'PR', cnpj: '99.999.999/0001-09' },
    { name: 'Tecidos Paraíba', phone: '(83) 3333-1010', email: 'contato@tecidospb.com.br', city: 'João Pessoa', state: 'PB', cnpj: '10.101.010/0001-10' },
  ];

  for (const s of suppliersData) {
    await prisma.supplier.upsert({
      where: { id: `supplier-${s.cnpj}` },
      update: {},
      create: { id: `supplier-${s.cnpj}`, ...s, companyId: company.id },
    });
  }
  console.log('Suppliers seeded');

  // Carriers
  const carriersData = [
    { name: 'Transportadora Gaúcha Express', phone: '(51) 3030-1001', city: 'Porto Alegre', state: 'RS', notes: 'Entrega em todo RS em 24h' },
    { name: 'Rodoviária Cargas Brasil', phone: '(11) 4040-2002', city: 'São Paulo', state: 'SP', notes: 'Cobertura nacional' },
    { name: 'LogFashion Transportes', phone: '(47) 3050-3003', city: 'Joinville', state: 'SC', notes: 'Especializada em moda' },
    { name: 'Rapidão Sul Logística', phone: '(54) 3060-4004', city: 'Caxias do Sul', state: 'RS', notes: 'Melhor custo-benefício para Serra' },
    { name: 'Frete Fácil Nordeste', phone: '(85) 3070-5005', city: 'Fortaleza', state: 'CE', notes: 'Entregas para região Nordeste' },
  ];

  for (const c of carriersData) {
    const carrierId = `carrier-${c.name.replace(/\s/g, '-').toLowerCase().substring(0, 20)}`;
    await prisma.carrier.upsert({
      where: { id: carrierId },
      update: {},
      create: { id: carrierId, ...c, companyId: company.id },
    });
  }
  console.log('Carriers seeded');

  // Sellers (linked to users)
  const sellersData = [
    { name: 'Ana Vendedora', phone: '(51) 99800-1001', commissionRate: 5, userId: vendedor1.id },
    { name: 'Pedro Vendedor', phone: '(51) 99800-2002', commissionRate: 6, userId: vendedor2.id },
    { name: 'Marcos Silva', phone: '(51) 99800-3003', commissionRate: 5.5, userId: null as string | null },
    { name: 'Juliana Costa', phone: '(51) 99800-4004', commissionRate: 5, userId: null as string | null },
    { name: 'Rafael Vendas', phone: '(51) 99800-5005', commissionRate: 4.5, userId: null as string | null },
  ];

  const sellerRecords: any[] = [];
  for (const s of sellersData) {
    const sellerId = `seller-${s.name.replace(/\s/g, '-').toLowerCase()}`;
    const seller = await prisma.seller.upsert({
      where: { id: sellerId },
      update: { userId: s.userId },
      create: { id: sellerId, name: s.name, phone: s.phone, commissionRate: s.commissionRate, userId: s.userId, companyId: company.id },
    });
    sellerRecords.push(seller);
  }
  console.log('Sellers seeded');

  // Assign some customers to sellers
  const allCustomers = await prisma.customer.findMany({ where: { companyId: company.id } });
  for (let i = 0; i < allCustomers.length; i++) {
    const assignedSeller = sellerRecords[i % sellerRecords.length];
    if (assignedSeller) {
      await prisma.customer.update({
        where: { id: allCustomers[i].id },
        data: { sellerId: assignedSeller.id },
      });
    }
  }
  console.log('Customers assigned to sellers');

  // Accounts Payable
  const today = new Date();
  const payablesData = [
    { description: 'Aluguel galpão - Janeiro', amount: 4500, dueDate: new Date(today.getFullYear(), today.getMonth(), 5), status: 'pago' },
    { description: 'Aluguel galpão - Fevereiro', amount: 4500, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 5), status: 'pendente' },
    { description: 'Energia elétrica', amount: 890, dueDate: new Date(today.getFullYear(), today.getMonth(), 15), status: 'pago' },
    { description: 'Internet e telefone', amount: 350, dueDate: new Date(today.getFullYear(), today.getMonth(), 10), status: 'pago' },
    { description: 'Compra Malhas Sul - Lote 45', amount: 12500, dueDate: new Date(today.getFullYear(), today.getMonth(), 20), status: 'pendente' },
    { description: 'Compra Jeans Brasil - Lote 22', amount: 8900, dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 25), status: 'vencido' },
    { description: 'Salários equipe', amount: 15000, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 1), status: 'pendente' },
    { description: 'FGTS', amount: 1800, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 7), status: 'pendente' },
    { description: 'Frete Gaúcha Express', amount: 1200, dueDate: new Date(today.getFullYear(), today.getMonth(), 25), status: 'pendente' },
    { description: 'Material de escritório', amount: 280, dueDate: new Date(today.getFullYear(), today.getMonth(), 18), status: 'pago' },
    { description: 'Manutenção sistema', amount: 450, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 15), status: 'pendente' },
    { description: 'Compra Têxtil Mineira - Lote 33', amount: 6700, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 10), status: 'pendente' },
    { description: 'Seguro do galpão', amount: 750, dueDate: new Date(today.getFullYear(), today.getMonth() + 2, 1), status: 'pendente' },
    { description: 'Marketing digital', amount: 1500, dueDate: new Date(today.getFullYear(), today.getMonth(), 28), status: 'pendente' },
    { description: 'Compra Nordeste Fashion - Lote 18', amount: 9800, dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 15), status: 'vencido' },
  ];

  const existingPayables = await prisma.accountPayable.count({ where: { companyId: company.id } });
  if (existingPayables === 0) {
    for (const p of payablesData) {
      await prisma.accountPayable.create({
        data: { ...p, companyId: company.id, paidDate: p.status === 'pago' ? new Date() : null },
      });
    }
    console.log('Accounts Payable seeded');
  }

  // Accounts Receivable
  const receivablesData = [
    { description: 'Venda parcelada - Loja Bella Moda', amount: 3500, dueDate: new Date(today.getFullYear(), today.getMonth(), 10), status: 'recebido' },
    { description: 'Venda parcelada - Boutique Chic', amount: 4200, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 5), status: 'pendente' },
    { description: 'Boleto - Moda Center SP 2/3', amount: 2800, dueDate: new Date(today.getFullYear(), today.getMonth(), 20), status: 'pendente' },
    { description: 'Boleto - Moda Center SP 3/3', amount: 2800, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 20), status: 'pendente' },
    { description: 'Venda a prazo - Revendedora Maria', amount: 1500, dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 28), status: 'vencido' },
    { description: 'Consignação - Loja Fashion Kids', amount: 3200, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 15), status: 'pendente' },
    { description: 'Venda parcelada - Atacado Norte', amount: 6500, dueDate: new Date(today.getFullYear(), today.getMonth(), 25), status: 'pendente' },
    { description: 'Boleto - Empório da Moda 1/2', amount: 1800, dueDate: new Date(today.getFullYear(), today.getMonth(), 12), status: 'recebido' },
    { description: 'Boleto - Empório da Moda 2/2', amount: 1800, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 12), status: 'pendente' },
    { description: 'Venda a prazo - Sr. José Lojista', amount: 900, dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 20), status: 'vencido' },
    { description: 'Venda parcelada - Vitrine Fashion', amount: 5200, dueDate: new Date(today.getFullYear(), today.getMonth() + 2, 1), status: 'pendente' },
    { description: 'Consignação - Closet da Lu', amount: 2100, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 25), status: 'pendente' },
    { description: 'Venda a prazo - Dona Rosa Revendas', amount: 1350, dueDate: new Date(today.getFullYear(), today.getMonth(), 30), status: 'pendente' },
    { description: 'Boleto - Mega Fashion Center', amount: 7800, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 8), status: 'pendente' },
    { description: 'Venda a prazo - Lojista Sul', amount: 2600, dueDate: new Date(today.getFullYear(), today.getMonth(), 18), status: 'recebido' },
    { description: 'Parcelamento - Rede Look', amount: 4100, dueDate: new Date(today.getFullYear(), today.getMonth() + 2, 10), status: 'pendente' },
    { description: 'Venda parcelada - Shopping Moda', amount: 3300, dueDate: new Date(today.getFullYear(), today.getMonth(), 22), status: 'pendente' },
    { description: 'Boleto - Style Point 1/3', amount: 2200, dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 10), status: 'vencido' },
    { description: 'Boleto - Style Point 2/3', amount: 2200, dueDate: new Date(today.getFullYear(), today.getMonth(), 10), status: 'pendente' },
    { description: 'Boleto - Style Point 3/3', amount: 2200, dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 10), status: 'pendente' },
  ];

  const existingReceivables = await prisma.accountReceivable.count({ where: { companyId: company.id } });
  if (existingReceivables === 0) {
    for (const r of receivablesData) {
      await prisma.accountReceivable.create({
        data: { ...r, companyId: company.id, receivedDate: r.status === 'recebido' ? new Date() : null },
      });
    }
    console.log('Accounts Receivable seeded');
  }

  console.log('Phase 2 seed completed!');

  // ===== CASH ACCOUNTS & PAYMENT METHODS =====
  const existingCashAccounts = await prisma.cashAccount.count({ where: { companyId: company.id } });
  if (existingCashAccounts === 0) {
    const caixaDinheiro = await prisma.cashAccount.create({
      data: { name: 'Caixa Dinheiro', type: 'dinheiro', initialBalance: 500, currentBalance: 500, companyId: company.id },
    });
    const bancoInter = await prisma.cashAccount.create({
      data: { name: 'Banco Inter', type: 'banco', initialBalance: 2000, currentBalance: 2000, companyId: company.id, notes: 'Conta PIX principal' },
    });
    const contaStone = await prisma.cashAccount.create({
      data: { name: 'Conta Cartão Stone', type: 'cartao', initialBalance: 0, currentBalance: 0, companyId: company.id, notes: 'Recebimentos Stone' },
    });
    const bancoItau = await prisma.cashAccount.create({
      data: { name: 'Banco Itaú', type: 'banco', initialBalance: 5000, currentBalance: 5000, companyId: company.id },
    });
    const contaMercadoPago = await prisma.cashAccount.create({
      data: { name: 'Mercado Pago', type: 'cartao', initialBalance: 0, currentBalance: 0, companyId: company.id, notes: 'Recebimentos Mercado Pago' },
    });
    console.log('Cash accounts seeded');

    // Payment Methods
    const existingPaymentMethods = await prisma.paymentMethod.count({ where: { companyId: company.id } });
    if (existingPaymentMethods === 0) {
      await prisma.paymentMethod.createMany({
        data: [
          { name: 'Dinheiro', type: 'dinheiro', cashAccountId: caixaDinheiro.id, defaultDays: 0, feePercent: 0, feeFixed: 0, businessDays: false, companyId: company.id },
          { name: 'PIX', type: 'pix', cashAccountId: bancoInter.id, defaultDays: 0, feePercent: 0, feeFixed: 0, businessDays: false, companyId: company.id },
          { name: 'Cartão Crédito Stone', type: 'cartao_credito', cashAccountId: contaStone.id, defaultDays: 30, feePercent: 3.5, feeFixed: 0, businessDays: false, companyId: company.id },
          { name: 'Cartão Débito Stone', type: 'cartao_debito', cashAccountId: contaStone.id, defaultDays: 1, feePercent: 1.8, feeFixed: 0, businessDays: true, companyId: company.id },
          { name: 'Cartão Crédito Mercado Pago', type: 'cartao_credito', cashAccountId: contaMercadoPago.id, defaultDays: 14, feePercent: 4.99, feeFixed: 0, businessDays: false, companyId: company.id },
          { name: 'Boleto', type: 'boleto', cashAccountId: bancoItau.id, defaultDays: 3, feePercent: 0, feeFixed: 3.5, businessDays: true, companyId: company.id },
          { name: 'Transferência Bancária', type: 'transferencia', cashAccountId: bancoItau.id, defaultDays: 0, feePercent: 0, feeFixed: 0, businessDays: false, companyId: company.id },
        ],
      });
      console.log('Payment methods seeded');
    }
  }

  // Add FinancialCategory for "Taxas" if not exists
  const existingTaxaCat = await prisma.financialCategory.findFirst({
    where: { companyId: company.id, name: { contains: 'Taxa', mode: 'insensitive' } },
  });
  if (!existingTaxaCat) {
    await prisma.financialCategory.create({
      data: { name: 'Taxas de Cartão', type: 'saida', companyId: company.id },
    });
    console.log('Taxa category seeded');
  }

  // ===== Plano de Contas padrão para loja de roupas =====
  const { seedAccountPlanForCompany } = await import('@/lib/account-plan-seed');
  const seedResult = await seedAccountPlanForCompany(company.id, prisma);
  console.log(`Account plans seeded: ${seedResult.created} criadas, ${seedResult.updated} atualizadas, ${seedResult.total} total`);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
