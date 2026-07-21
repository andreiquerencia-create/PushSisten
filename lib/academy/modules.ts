export interface AcademyStep {
  title: string; // Cabeçalho destacado
  body: string; // Texto completo da instrução
  route?: string; // Se definido, navega para essa rota
  celebration?: boolean; // Se é um step de celebração
}

export interface AcademyModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedTime: string;
  steps: AcademyStep[];
}

export const ACADEMY_MODULES: AcademyModule[] = [
  {
    id: 'modulo-1',
    title: 'Comece Aqui',
    description: 'Prepare sua empresa para realizar a primeira venda.',
    icon: '🚀',
    estimatedTime: '10 min',
    steps: [
      {
        title: 'Bem-vindo ao PushSisten!',
        body: '👋 Vamos conhecer o sistema juntos.\n\n📌 No menu à esquerda você encontra todas as áreas do sistema: vendas, produtos, clientes, financeiro e muito mais.\n\n🏠 Clique em "Hoje" no menu para ver a Central do Dia — onde tudo começa.\n\n📊 Ali você verá o resumo do dia: vendas, caixa, cobranças e saúde da loja.\n\n👉 Quando estiver pronto, clique em Próximo para criar sua primeira categoria.',
        route: '/hoje',
      },
      {
        title: 'Crie sua primeira categoria',
        body: '🗂️ Categorias organizam seus produtos. Ex: Blusas, Calças, Acessórios.\n\n👉 Clique em "Nova Categoria"\n✏️ Digite o nome da categoria (ex: Blusas)\n💾 Clique em Salvar\n\n💡 Você pode criar quantas categorias quiser. Quando terminar, clique em Próximo.',
        route: '/categorias',
      },
      {
        title: 'Cadastre um fornecedor (opcional)',
        body: '🏭 Fornecedores ajudam a rastrear de quem você compra.\n\n👉 Clique em "Novo"\n✏️ Preencha o nome do fornecedor\n💾 Clique em Salvar\n\n💡 Os outros campos são opcionais. Se não quiser cadastrar agora, pode pular direto para o próximo passo.',
        route: '/fornecedores',
      },
      {
        title: 'Cadastre seu primeiro produto',
        body: '📦 Agora vamos cadastrar seu primeiro produto.\n\n👉 Clique em "Novo Produto"\n✏️ Digite o nome (ex: Blusa Modal Preta)\n💲 Informe o preço de custo (quanto você pagou)\n💰 Informe o preço de venda\n📊 Defina a quantidade em estoque\n🗂️ Selecione a categoria que você criou\n💾 Clique em Salvar',
        route: '/produtos',
      },
      {
        title: '✅ Produto cadastrado!',
        body: '🎯 Ele já está pronto para ser vendido no PDV.\n\n👉 Agora vamos cadastrar seu primeiro cliente.',
        celebration: true,
      },
      {
        title: 'Cadastre seu primeiro cliente',
        body: '👥 Clientes permitem rastrear compras e oferecer crediário.\n\n👉 Clique em "Novo Cliente"\n✏️ Preencha o nome e o telefone\n💾 Clique em Salvar\n\n💡 Os outros campos são opcionais. Você também pode cadastrar clientes direto no PDV durante a venda.',
        route: '/clientes',
      },
      {
        title: '🎉 Módulo 1 concluído!',
        body: '🏆 Sua empresa já tem categoria, produto e cliente cadastrados.\n\n🚀 Você está pronto para fazer sua primeira venda!\n\n👉 Clique em Concluir para voltar ao Push Academy e iniciar o Módulo 2.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-2',
    title: 'Primeira Venda',
    description: 'Realize sua primeira venda completa no PDV.',
    icon: '🛒',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Vamos fazer sua primeira venda!',
        body: '🛒 O PDV é onde as vendas acontecem.\n\n🔍 No campo "Buscar produto", digite o nome do produto que cadastrou\n👉 Clique no produto para adicioná-lo ao carrinho\n👤 No campo "Cliente", busque e selecione o cliente (ou deixe em branco)\n💳 Clique em "Pagamento"\n✅ Selecione a forma (Dinheiro, PIX, Cartão...)\n🏁 Clique em "Finalizar Venda"',
        route: '/pdv',
      },
      {
        title: '🎉 Primeira venda realizada!',
        body: '🏆 Parabéns! Sua venda foi registrada com sucesso.\n\n📦 O estoque foi atualizado automaticamente\n💰 O financeiro registrou a entrada\n🏦 O caixa foi creditado\n\n🚀 Você já pode operar sua loja no dia a dia.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-3',
    title: 'Entendendo suas Vendas',
    description: 'Consulte, pesquise e gerencie suas vendas.',
    icon: '📋',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Consulte suas vendas',
        body: '📋 Aqui ficam todas as vendas realizadas.\n\n🔍 Use os filtros para encontrar vendas por status, período ou vendedor\n👉 Clique em uma venda para ver os detalhes completos\n🖨️ Você pode imprimir o comprovante novamente\n❌ Pode cancelar uma venda se necessário\n\n💡 Todas as informações de cada venda ficam registradas aqui.',
        route: '/vendas',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe consultar e gerenciar suas vendas.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-4',
    title: 'Gerenciando Clientes',
    description: 'Edite, pesquise e acompanhe seus clientes.',
    icon: '👥',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Gerencie sua base de clientes',
        body: '👥 Aqui você gerencia todos os seus clientes.\n\n🔍 Use a busca para encontrar por nome ou telefone\n👉 Clique em um cliente para ver o histórico de compras\n🏷️ Edite dados, adicione etiquetas (VIP, inadimplente, etc)\n📂 Filtre por tipo: Varejo, Lojista, Revendedor\n\n💡 Clientes bem organizados facilitam vendas futuras e crediário.',
        route: '/clientes',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe gerenciar sua base de clientes.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-5',
    title: 'Estoque',
    description: 'Controle entradas, saídas e ajustes de estoque.',
    icon: '📦',
    estimatedTime: '8 min',
    steps: [
      {
        title: 'Controle seu estoque',
        body: '📦 O estoque mostra a situação de todos os seus produtos.\n\n📊 Aba "Executivo": valor total, alertas e curva ABC\n🔧 Aba "Operação": ajustes manuais de quantidade\n📋 Aba "Movimentações": todas as entradas e saídas\n📥 Aba "Entradas": registre recebimento de mercadorias\n\n💡 O estoque atualiza automaticamente a cada venda.',
        route: '/estoque',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe controlar seu estoque.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-6',
    title: 'Financeiro Básico',
    description: 'Controle receitas e despesas da sua empresa.',
    icon: '💰',
    estimatedTime: '8 min',
    steps: [
      {
        title: 'Lançamentos financeiros',
        body: '💰 Aqui você controla tudo que entra e sai de dinheiro.\n\n📝 Para registrar uma despesa:\n👉 Clique em "Nova Saída"\n✏️ Preencha: descrição, valor, data e categoria\n💾 Clique em Salvar\n\n💡 As entradas de vendas aparecem automaticamente. Você só precisa registrar despesas (aluguel, fornecedores, salários, etc).\n\n⚠️ Lançamentos "Sem Classificação" precisam ser categorizados para aparecer corretamente no DRE.',
        route: '/financeiro',
      },
      {
        title: 'Metas & Equilíbrio',
        body: '🎯 Nesta aba você descobre quanto precisa vender para cobrir seus custos.\n\n📊 Ponto de Equilíbrio: valor mínimo de vendas para não ter prejuízo\n📅 Meta Diária: quanto precisa faturar por dia\n📈 Meta Semanal: objetivo da semana\n💰 Lucro Projetado: estimativa de lucro no período\n\n📉 "Quanto Preciso Vender?": mostra o faturado vs. ponto de equilíbrio\n⏳ Falta Vender: quanto ainda precisa no mês\n📆 Dias Restantes: dias úteis até o fim do mês\n\n💡 Clique na aba "Metas & Equilíbrio" para visualizar.',
        route: '/financeiro',
      },
      {
        title: 'Simulador de Crescimento',
        body: '📐 O Simulador calcula cenários de crescimento para sua empresa.\n\n🔢 Preencha:\n💸 Despesas mensais (R$)\n📊 Margem média (%)\n💰 Faturamento atual (R$)\n📈 Crescimento desejado (%)\n🎯 Lucro desejado (R$)\n\n👉 Clique em "Calcular"\n\n📋 O sistema mostra simulações de crescimento (10%, 20%, 30%) com:\n• Meta mensal e diária\n• Lucro estimado para cada cenário\n\n💡 Use o simulador para definir metas realistas de crescimento.',
        route: '/financeiro',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe registrar despesas, interpretar metas e simular crescimento.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-7',
    title: 'Caixas',
    description: 'Abra, feche e gerencie seus caixas.',
    icon: '🏦',
    estimatedTime: '8 min',
    steps: [
      {
        title: 'Visão Geral dos Caixas',
        body: '🏦 Caixas são onde o dinheiro fica. Todo pagamento vai para um caixa.\n\n👁️ Na aba "Visão Geral" você vê:\n💰 Saldo Total de todos os caixas\n📊 Saldo individual de cada caixa\n🔘 Caixas ativos e inativos\n\n💡 Você pode ter vários caixas: Dinheiro, PIX, Stone, Maquininha, etc. Cada forma de pagamento pode ir para um caixa diferente.',
        route: '/caixas',
      },
      {
        title: 'Histórico de Movimentações',
        body: '📋 Na aba "Histórico" você vê TUDO que entrou e saiu de cada caixa.\n\n📅 Data e hora de cada movimentação\n🏷️ Tipo: Entrada ou Saída\n📝 Origem: venda, recebimento, ajuste, transferência\n👤 Responsável: quem fez a operação\n💲 Valor\n\n💡 Use o filtro por caixa para ver movimentações específicas. Clique em "+ Lançamento" para registrar entradas/saídas manuais.',
        route: '/caixas',
      },
      {
        title: 'Abertura e Fechamento',
        body: '🔓 Na aba "Fechamento" você controla as sessões de caixa.\n\n▶️ Abrir Caixa: inicie o dia informando o saldo inicial (contagem física)\n⏹️ Fechar Caixa: encerre o dia conferindo o saldo final\n\n📊 O sistema mostra:\n🏦 Saldo de abertura\n💰 Saldo do sistema (calculado)\n🧮 Saldo real contado\n⚠️ Diferença (se houver)\n\n💡 Abra o caixa toda manhã. Feche no final do expediente. Isso garante controle.',
        route: '/caixas',
      },
      {
        title: 'Ajuste de Caixa',
        body: '🔧 O "Ajuste de Caixa" serve para corrigir diferenças entre o saldo do sistema e o saldo real.\n\n📝 Como usar:\n👉 Clique em "Ajuste de Caixa"\n🏦 Selecione o caixa\n🧮 Informe o saldo real contado\n📂 Escolha o tipo de ajuste (Diferença Encontrada)\n✏️ Descreva o motivo\n💾 Confirme\n\n💡 Use quando contar o dinheiro e o valor não bater com o sistema.',
        route: '/caixas',
      },
      {
        title: 'Reconciliação de Saldos',
        body: '✅ A "Reconciliação" verifica a integridade de todos os caixas.\n\n🔍 O que faz:\n🧮 Recalcula saldos a partir do saldo inicial + todas as movimentações\n⚠️ Identifica e corrige divergências automáticas\n\n👉 Clique em "Reconciliar"\n🛡️ Clique em "Verificar Saldos"\n\n💡 Use quando suspeitar que o saldo está incorreto ou após importações/ajustes.',
        route: '/caixas',
      },
      {
        title: 'Transferências entre Caixas',
        body: '🔄 "Transferir" move dinheiro de um caixa para outro.\n\n📝 Como usar:\n👉 Clique em "Transferir"\n🏦 Selecione o caixa de origem\n🏦 Selecione o caixa de destino\n💲 Informe o valor\n💾 Confirme\n\n💡 Use quando precisar mover dinheiro entre caixas (ex: tirar dinheiro do caixa físico e depositar no banco).',
        route: '/caixas',
      },
      {
        title: 'Criar Novo Caixa',
        body: '➕ "Novo Caixa" cria um caixa adicional para sua empresa.\n\n📝 Como usar:\n👉 Clique em "+ Novo Caixa"\n✏️ Defina o nome (ex: Banco Itaú, Cofre, Maquininha Stone)\n🏷️ Escolha o tipo: Físico ou Digital\n💾 Salve\n\n💡 Crie caixas separados para cada forma de recebimento. Isso facilita a conferência e o controle.',
        route: '/caixas',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você domina a gestão de caixas: abertura, fechamento, ajustes, reconciliação, transferências e criação de novos caixas.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-8',
    title: 'Formas de Pagamento',
    description: 'Configure dinheiro, PIX, cartão e crediário.',
    icon: '💳',
    estimatedTime: '3 min',
    steps: [
      {
        title: 'Configure seus pagamentos',
        body: '💳 Aqui você configura como seus clientes podem pagar.\n\n✅ O sistema já vem com: Dinheiro, PIX, Cartão de Crédito, Cartão de Débito e Boleto.\n\n🔧 Você pode:\n✏️ Editar taxas e prazos de cada forma\n🏦 Definir o caixa destino de cada forma\n➕ Criar novas formas personalizadas\n🚫 Desativar formas que não usa',
        route: '/formas-pagamento',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Suas formas de pagamento estão configuradas.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-9',
    title: 'Crediário',
    description: 'Venda fiado com controle de parcelas.',
    icon: '📝',
    estimatedTime: '8 min',
    steps: [
      {
        title: 'Painel do Crediário',
        body: '📝 O crediário permite vender a prazo com parcelas controladas.\n\n📊 No Painel você vê:\n💰 Total a Receber: quanto seus clientes devem\n⚠️ Total Vencido: parcelas que passaram do prazo\n✅ Recebido (30d): quanto entrou nos últimos 30 dias\n📉 Inadimplência: percentual de atraso\n\n👥 Maiores Devedores: ranking dos que mais devem\n📊 Distribuição por Status: Vencido, Pago, Pendente\n\n💡 Monitore diariamente para evitar inadimplência alta.',
        route: '/crediario',
      },
      {
        title: 'Créditos dos Clientes',
        body: '💳 Na aba "Créditos" você gerencia o limite de cada cliente.\n\n📋 Para cada cliente você vê:\n💰 Limite: quanto ele pode comprar no fiado\n📊 Utilizado: quanto já usou\n✅ Disponível: quanto ainda pode comprar\n📅 Prazo: dias para pagamento\n🔴 Status: Ativo ou Bloqueado\n\n➕ Clique em "+ Novo Crédito" para liberar crediário para um cliente\n👉 Defina o limite e o prazo de pagamento\n\n💡 Bloqueie clientes inadimplentes clicando no ícone de ação.',
        route: '/crediario',
      },
      {
        title: 'Gestão de Parcelas',
        body: '📅 Na aba "Parcelas" você controla cada parcela individualmente.\n\n📋 Informações de cada parcela:\n👤 Cliente\n🧾 Venda de origem\n🔢 Número da parcela\n💲 Valor e quanto foi pago\n📅 Vencimento\n🔴 Status: Pendente ou Vencida\n\n💰 Para receber:\n☑️ Selecione as parcelas\n👉 Clique em "Receber"\n\n⚠️ Filtre por "Vencidas" para priorizar cobranças\n🔄 Use "Renegociar" para parcelas difíceis\n\n💡 Acompanhe semanalmente para manter a inadimplência baixa.',
        route: '/crediario',
      },
      {
        title: 'Renegociações',
        body: '🔄 Na aba "Renegociações" você reorganiza dívidas de clientes com dificuldade de pagar.\n\n📝 Como renegociar:\n👉 Vá em "Parcelas" → selecione parcelas vencidas\n🔄 Clique em "Renegociar"\n✏️ Defina novas condições (prazo, número de parcelas, desconto)\n💾 Confirme\n\n📋 O histórico mostra todas as renegociações feitas\n🔍 Busque por cliente ou referência\n\n💡 Renegociar é melhor que perder o cliente. Ofereça condições viáveis.',
        route: '/crediario',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você domina o crediário: painel, créditos, parcelas e renegociações.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-10',
    title: 'Fluxo de Caixa',
    description: 'Veja a projeção financeira da sua empresa.',
    icon: '📈',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Previsão de caixa',
        body: '📈 O Fluxo de Caixa mostra quanto dinheiro você terá no futuro.\n\n📅 Veja o saldo projetado para 7, 30, 60 ou 90 dias\n📉 O gráfico mostra a tendência (vai sobrar ou faltar dinheiro?)\n💰 "Próximos Recebimentos": o que vai entrar\n💸 "Próximos Pagamentos": o que vai sair\n\n💡 Use essa informação para planejar compras e pagamentos.',
        route: '/fluxo-caixa',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe interpretar seu fluxo de caixa.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-11',
    title: 'Plano de Contas',
    description: 'Organize categorias financeiras.',
    icon: '🗂️',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Categorias financeiras',
        body: '🗂️ O Plano de Contas organiza suas receitas e despesas por categoria.\n\n💰 Receitas: tudo que entra (vendas, serviços)\n📦 Custos/CMV: custo do que vendeu\n🧾 Despesas: aluguel, salários, marketing\n🏛️ Impostos: tributos\n\n💡 Isso permite gerar o DRE (resultado). O sistema já vem com um plano padrão que você pode personalizar.',
        route: '/plano-contas',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você entende o plano de contas.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-12',
    title: 'Resultado (DRE)',
    description: 'Entenda o lucro real da sua empresa.',
    icon: '📊',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Demonstrativo de Resultado',
        body: '📊 O DRE mostra se sua empresa está dando lucro ou prejuízo.\n\n➕ Faturamento Bruto: tudo que vendeu\n➖ CMV: quanto custou o que vendeu\n🟰 Lucro Bruto\n➖ Despesas Operacionais: aluguel, salários, etc\n🟰 Lucro Líquido: o que sobra no final\n\n💡 Acompanhe por período: hoje, 7 dias, 30 dias, trimestre ou ano.',
        route: '/dre',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe ler o resultado da sua empresa.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-13',
    title: 'Visão Executiva',
    description: 'Indicadores e decisões estratégicas.',
    icon: '🎯',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Painel executivo',
        body: '🎯 A Visão Executiva reúne os indicadores mais importantes.\n\n💰 Faturamento, Lucro, Margem, Ticket Médio\n🏦 Caixa Disponível, A Receber\n🏆 Top Produtos, Ranking de Vendedores\n⏰ Horários de Pico, Formas de Pagamento\n\n📅 Use os filtros de período: Hoje, Semana, Mês, Trimestre, Ano.\n\n💡 Foco: transformar indicadores em decisões.',
        route: '/executivo',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe usar a Visão Executiva para tomar decisões.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-14',
    title: 'Relatórios',
    description: 'Gere relatórios detalhados da operação.',
    icon: '📑',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Relatórios operacionais',
        body: '📑 Os Relatórios detalham sua operação em diferentes ângulos.\n\n📊 Vendas por período, por vendedor, por produto\n💲 Tabelas de preço\n📦 Estoque: produtos parados, inativos\n🏆 Top Produtos, Top Clientes\n\n💡 Use os filtros de período e as abas para navegar entre os relatórios.',
        route: '/relatorios',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe gerar e interpretar relatórios.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-15',
    title: 'Saúde da Loja (Push Score)',
    description: 'Entenda e melhore a saúde do seu negócio.',
    icon: '❤️',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Push Score',
        body: '❤️ O Push Score mede a saúde geral da sua loja.\n\n📊 Ele analisa:\n🛒 Vendas e faturamento\n💰 Margem de lucro\n📦 Giro de estoque\n👥 Relacionamento com clientes\n🏦 Saúde financeira\n\n💡 Quanto maior o score, mais saudável está sua empresa. O sistema dá dicas de como melhorar cada indicador.',
        route: '/push-score',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você entende seu Push Score.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-16',
    title: 'IA Gerente',
    description: 'Use inteligência artificial para gerenciar melhor.',
    icon: '🤖',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Seu gerente inteligente',
        body: '🤖 A IA Gerente analisa sua empresa e dá recomendações.\n\n📋 "Resumo": diagnóstico geral da loja\n💬 "Chat": converse e peça análises específicas\n🔍 Identifica problemas e oportunidades\n📌 Prioriza ações por impacto\n\n💡 Use a IA como aliada para tomar decisões melhores e mais rápidas.',
        route: '/ia-gerente',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe usar a IA Gerente.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-17',
    title: 'Relatórios Inteligentes',
    description: 'Análises automáticas com IA.',
    icon: '🧠',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Análises com IA',
        body: '🧠 Relatórios Inteligentes são gerados automaticamente pela IA.\n\n📊 Análise financeira detalhada\n📈 Indicadores de performance\n📦 CMV e margens por produto\n🏷️ Classificação automática de despesas\n💡 Oportunidades identificadas\n\n🔮 Diferente dos relatórios tradicionais, aqui a IA interpreta os dados por você.',
        route: '/relatorios-inteligentes',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você conhece os Relatórios Inteligentes.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-18',
    title: 'Usuários',
    description: 'Crie usuários e defina permissões.',
    icon: '👤',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Gestão de usuários',
        body: '👤 Aqui você cria contas para sua equipe.\n\n👉 Clique em "Novo Usuário"\n✏️ Defina: nome, email, senha\n🔑 Escolha o perfil:\n\n👑 Administrador: acesso total\n📋 Gerente: acesso operacional + financeiro\n🛒 Vendedor: apenas PDV e meu painel\n\n💡 Cada perfil tem permissões diferentes no sistema.',
        route: '/usuarios',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe gerenciar usuários.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-19',
    title: 'Vendedores',
    description: 'Cadastre vendedores e gerencie comissões.',
    icon: '🏷️',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Gestão de vendedores',
        body: '🏷️ Vendedores são vinculados às vendas para controle de comissão.\n\n👉 Clique em "Novo Vendedor"\n✏️ Preencha nome e telefone\n💲 Defina o percentual de comissão\n\n💡 No PDV, o vendedor poderá ser selecionado em cada venda. O sistema calcula a comissão automaticamente.',
        route: '/vendedores',
      },
      {
        title: '✅ Módulo concluído!',
        body: '🏆 Agora você sabe cadastrar vendedores e controlar comissões.',
        celebration: true,
      },
    ],
  },
  {
    id: 'modulo-20',
    title: 'Importação de Dados',
    description: 'Importe produtos, clientes e estoque via planilha.',
    icon: '📥',
    estimatedTime: '5 min',
    steps: [
      {
        title: 'Importe seus dados',
        body: '📥 Se você já tem dados em planilhas, pode importar tudo de uma vez.\n\n1️⃣ Escolha o que importar: Clientes, Produtos ou Estoque\n2️⃣ Baixe o modelo de planilha\n3️⃣ Preencha com seus dados\n4️⃣ Faça upload do arquivo\n5️⃣ O sistema valida e importa automaticamente\n\n💡 Ideal para quem está migrando de outro sistema ou tem muitos itens para cadastrar.',
        route: '/importacao',
      },
      {
        title: '🎓 Push Academy concluído!',
        body: '🏆 Parabéns por completar todos os módulos!\n\n🚀 Agora você domina o PushSisten.\n\n💡 Lembre-se: você pode repetir qualquer módulo quando quiser.',
        celebration: true,
      },
    ],
  },
];

export function getModuleById(id: string): AcademyModule | undefined {
  return ACADEMY_MODULES.find(m => m.id === id);
}

export function getTotalStepsForModule(moduleId: string): number {
  const mod = getModuleById(moduleId);
  if (!mod) return 0;
  return mod.steps.length;
}
