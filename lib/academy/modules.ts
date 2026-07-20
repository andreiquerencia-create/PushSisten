export interface AcademyStep {
  instruction: string;
  route?: string; // Se definido, navega para essa rota neste passo
}

export interface AcademySubmodule {
  id: string;
  title: string;
  steps: AcademyStep[];
}

export interface AcademyModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedTime: string;
  submodules: AcademySubmodule[];
}

export const ACADEMY_MODULES: AcademyModule[] = [
  {
    id: 'modulo-1',
    title: 'Comece Aqui',
    description: 'Prepare sua empresa para realizar a primeira venda.',
    icon: '🚀',
    estimatedTime: '10 min',
    submodules: [
      {
        id: '1.1',
        title: 'Conhecendo o Push',
        steps: [
          { instruction: 'Bem-vindo ao PushSisten! Vamos conhecer o sistema juntos.' },
          { instruction: 'No menu à esquerda você encontra todas as áreas do sistema.' },
          { instruction: 'Clique em "Hoje" no menu. Essa é sua Central do Dia — onde tudo começa.', route: '/hoje' },
          { instruction: 'Aqui você verá o resumo do dia: vendas, caixa, cobranças e saúde da loja.' },
          { instruction: 'Agora vamos para o próximo passo: criar sua primeira categoria.' },
        ],
      },
      {
        id: '1.2',
        title: 'Sua primeira categoria',
        steps: [
          { instruction: 'Categorias organizam seus produtos. Ex: Blusas, Calças, Acessórios.', route: '/categorias' },
          { instruction: 'Clique em "Nova Categoria" para criar a primeira.' },
          { instruction: 'Digite o nome da categoria (ex: Blusas) e clique em Salvar.' },
          { instruction: '✅ Categoria criada! Agora seus produtos terão organização.' },
        ],
      },
      {
        id: '1.3',
        title: 'Seu primeiro fornecedor',
        steps: [
          { instruction: 'Fornecedores são opcionais, mas ajudam a rastrear de quem você compra.', route: '/fornecedores' },
          { instruction: 'Clique em "Novo" para cadastrar um fornecedor.' },
          { instruction: 'Preencha o nome e clique em Salvar. Os outros campos são opcionais.' },
          { instruction: '✅ Fornecedor cadastrado! Você poderá vinculá-lo aos seus produtos.' },
        ],
      },
      {
        id: '1.4',
        title: 'Seu primeiro produto',
        steps: [
          { instruction: 'Agora vamos cadastrar seu primeiro produto.', route: '/produtos' },
          { instruction: 'Clique em "Novo Produto".' },
          { instruction: 'Digite o nome do produto (ex: Blusa Modal Preta).' },
          { instruction: 'Informe o preço de venda.' },
          { instruction: 'Informe o preço de custo (quanto você pagou).' },
          { instruction: 'Defina a quantidade em estoque.' },
          { instruction: 'Selecione a categoria que você criou.' },
          { instruction: 'Clique em Salvar.' },
          { instruction: '✅ Produto cadastrado! Ele já está pronto para ser vendido no PDV.' },
        ],
      },
      {
        id: '1.5',
        title: 'Seu primeiro cliente',
        steps: [
          { instruction: 'Clientes permitem rastrear compras e oferecer crediário.', route: '/clientes' },
          { instruction: 'Clique em "Novo Cliente".' },
          { instruction: 'Preencha o nome e o telefone. Os outros campos são opcionais.' },
          { instruction: 'Clique em Salvar.' },
          { instruction: '✅ Cliente cadastrado! Agora você poderá associá-lo às vendas.' },
        ],
      },
    ],
  },
  {
    id: 'modulo-2',
    title: 'Primeira Venda',
    description: 'Realize sua primeira venda completa no PDV.',
    icon: '🛒',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '2.1',
        title: 'Vendendo no PDV',
        steps: [
          { instruction: 'Vamos fazer sua primeira venda!', route: '/pdv' },
          { instruction: 'No campo "Buscar produto", digite o nome do produto que cadastrou.' },
          { instruction: 'Clique no produto para adicioná-lo ao carrinho.' },
          { instruction: 'No campo "Cliente", busque e selecione o cliente (ou deixe em branco).' },
          { instruction: 'Clique em "Pagamento" para escolher a forma de pagamento.' },
          { instruction: 'Selecione a forma (Dinheiro, PIX, Cartão...) e confirme.' },
          { instruction: 'Clique em "Finalizar Venda".' },
          { instruction: '🎉 Parabéns! Sua primeira venda foi registrada!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-3',
    title: 'Entendendo suas Vendas',
    description: 'Consulte, pesquise e gerencie suas vendas.',
    icon: '📋',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '3.1',
        title: 'Consultando vendas',
        steps: [
          { instruction: 'Aqui ficam todas as vendas realizadas.', route: '/vendas' },
          { instruction: 'Use os filtros para encontrar vendas por status, período ou vendedor.' },
          { instruction: 'Clique em uma venda para ver os detalhes.' },
          { instruction: 'Você pode imprimir o comprovante ou cancelar a venda se necessário.' },
          { instruction: '✅ Agora você sabe consultar e gerenciar suas vendas!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-4',
    title: 'Gerenciando Clientes',
    description: 'Edite, pesquise e acompanhe seus clientes.',
    icon: '👥',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '4.1',
        title: 'Gestão de clientes',
        steps: [
          { instruction: 'Aqui você gerencia todos os seus clientes.', route: '/clientes' },
          { instruction: 'Use a busca para encontrar clientes pelo nome ou telefone.' },
          { instruction: 'Clique em um cliente para ver o histórico de compras.' },
          { instruction: 'Você pode editar dados, adicionar etiquetas (VIP, inadimplente, etc).' },
          { instruction: '✅ Agora você sabe gerenciar sua base de clientes!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-5',
    title: 'Estoque',
    description: 'Controle entradas, saídas e ajustes de estoque.',
    icon: '📦',
    estimatedTime: '8 min',
    submodules: [
      {
        id: '5.1',
        title: 'Gestão de estoque',
        steps: [
          { instruction: 'O estoque mostra a situação de todos os seus produtos.', route: '/estoque' },
          { instruction: 'Na aba "Executivo" você vê o valor total, alertas e curva ABC.' },
          { instruction: 'Na aba "Operação" você faz ajustes manuais de quantidade.' },
          { instruction: 'Na aba "Movimentações" você vê todas as entradas e saídas.' },
          { instruction: 'Na aba "Entradas" você registra recebimento de mercadorias.' },
          { instruction: '✅ Agora você sabe controlar seu estoque!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-6',
    title: 'Financeiro Básico',
    description: 'Controle receitas e despesas da sua empresa.',
    icon: '💰',
    estimatedTime: '8 min',
    submodules: [
      {
        id: '6.1',
        title: 'Recebimentos e pagamentos',
        steps: [
          { instruction: 'Aqui você controla tudo que entra e sai de dinheiro.', route: '/financeiro' },
          { instruction: 'Clique em "Nova Saída" para registrar uma despesa.' },
          { instruction: 'Preencha: descrição, valor, data e categoria.' },
          { instruction: 'Clique em Salvar.' },
          { instruction: 'As entradas de vendas aparecem automaticamente.' },
          { instruction: '✅ Agora você sabe registrar suas despesas!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-7',
    title: 'Caixas',
    description: 'Abra, feche e gerencie seus caixas.',
    icon: '🏦',
    estimatedTime: '8 min',
    submodules: [
      {
        id: '7.1',
        title: 'Gestão de caixas',
        steps: [
          { instruction: 'Caixas são onde o dinheiro fica. Todo pagamento vai para um caixa.', route: '/caixas' },
          { instruction: 'Na "Visão Geral" você vê o saldo de cada caixa.' },
          { instruction: 'Clique em "Abrir Caixa" para iniciar o dia. Informe o saldo inicial.' },
          { instruction: 'No "Histórico" você vê todas as movimentações.' },
          { instruction: 'No "Fechamento" você confere e fecha o caixa no fim do dia.' },
          { instruction: '✅ Agora você sabe gerenciar seus caixas!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-8',
    title: 'Formas de Pagamento',
    description: 'Configure dinheiro, PIX, cartão e crediário.',
    icon: '💳',
    estimatedTime: '3 min',
    submodules: [
      {
        id: '8.1',
        title: 'Configurando pagamentos',
        steps: [
          { instruction: 'Aqui você configura como seus clientes podem pagar.', route: '/formas-pagamento' },
          { instruction: 'O sistema já vem com: Dinheiro, PIX, Cartão de Crédito, Cartão de Débito e Boleto.' },
          { instruction: 'Você pode editar taxas e prazos de cada forma.' },
          { instruction: 'Cada forma de pagamento direciona o valor para um caixa destino.' },
          { instruction: '✅ Suas formas de pagamento estão configuradas!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-9',
    title: 'Crediário',
    description: 'Venda fiado com controle de parcelas.',
    icon: '📝',
    estimatedTime: '8 min',
    submodules: [
      {
        id: '9.1',
        title: 'Usando o crediário',
        steps: [
          { instruction: 'O crediário permite vender a prazo com parcelas controladas.', route: '/crediario' },
          { instruction: 'No "Painel" você vê: total a receber, vencidos e inadimplência.' },
          { instruction: 'Em "Créditos" você vê o limite de cada cliente.' },
          { instruction: 'Em "Parcelas" você vê todas as parcelas pendentes e vencidas.' },
          { instruction: 'Para receber, clique na parcela e registre o pagamento.' },
          { instruction: '✅ Agora você sabe usar o crediário!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-10',
    title: 'Fluxo de Caixa',
    description: 'Veja a projeção financeira da sua empresa.',
    icon: '📈',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '10.1',
        title: 'Previsão de caixa',
        steps: [
          { instruction: 'O Fluxo de Caixa mostra quanto dinheiro você terá no futuro.', route: '/fluxo-caixa' },
          { instruction: 'Veja o saldo projetado para 7, 30, 60 ou 90 dias.' },
          { instruction: 'O gráfico mostra a tendência — se vai sobrar ou faltar dinheiro.' },
          { instruction: 'Use essa informação para planejar compras e pagamentos.' },
          { instruction: '✅ Agora você sabe interpretar seu fluxo de caixa!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-11',
    title: 'Plano de Contas',
    description: 'Organize categorias financeiras.',
    icon: '🗂️',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '11.1',
        title: 'Categorias financeiras',
        steps: [
          { instruction: 'O Plano de Contas organiza suas receitas e despesas por categoria.', route: '/plano-contas' },
          { instruction: 'Receitas, Custos, Despesas, Impostos — tudo separado.' },
          { instruction: 'Isso permite gerar o DRE (resultado) da sua empresa.' },
          { instruction: 'O sistema já vem com um plano padrão. Você pode personalizar.' },
          { instruction: '✅ Agora você entende o plano de contas!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-12',
    title: 'Resultado (DRE)',
    description: 'Entenda o lucro real da sua empresa.',
    icon: '📊',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '12.1',
        title: 'Demonstrativo de resultado',
        steps: [
          { instruction: 'O DRE mostra se sua empresa está dando lucro ou prejuízo.', route: '/dre' },
          { instruction: 'Faturamento Bruto: tudo que você vendeu.' },
          { instruction: 'CMV (Custo da Mercadoria): quanto custou o que vendeu.' },
          { instruction: 'Lucro Bruto: faturamento menos custo.' },
          { instruction: 'Despesas Operacionais: aluguel, salários, etc.' },
          { instruction: 'Lucro Líquido: o que sobra no final.' },
          { instruction: '✅ Agora você sabe ler o resultado da sua empresa!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-13',
    title: 'Visão Executiva',
    description: 'Indicadores e decisões estratégicas.',
    icon: '🎯',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '13.1',
        title: 'Painel executivo',
        steps: [
          { instruction: 'A Visão Executiva reúne os indicadores mais importantes.', route: '/executivo' },
          { instruction: 'Faturamento, Lucro, Margem, Ticket Médio, Caixa.' },
          { instruction: 'Use os filtros de período: Hoje, Semana, Mês, Trimestre, Ano.' },
          { instruction: 'Abaixo você vê: Top Produtos, Ranking de Vendedores, Horários de Pico.' },
          { instruction: '✅ Agora você sabe usar a Visão Executiva para tomar decisões!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-14',
    title: 'Relatórios',
    description: 'Gere relatórios detalhados da operação.',
    icon: '📑',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '14.1',
        title: 'Relatórios operacionais',
        steps: [
          { instruction: 'Os Relatórios detalham sua operação em diferentes ângulos.', route: '/relatorios' },
          { instruction: 'Vendas por período, por vendedor, por produto.' },
          { instruction: 'Estoque parado, produtos inativos, melhores clientes.' },
          { instruction: 'Use os filtros de período e as abas para navegar.' },
          { instruction: '✅ Agora você sabe gerar e interpretar relatórios!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-15',
    title: 'Saúde da Loja (Push Score)',
    description: 'Entenda e melhore a saúde do seu negócio.',
    icon: '❤️',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '15.1',
        title: 'Push Score',
        steps: [
          { instruction: 'O Push Score mede a saúde geral da sua loja.', route: '/push-score' },
          { instruction: 'Ele analisa: vendas, margem, estoque, clientes e financeiro.' },
          { instruction: 'Quanto maior o score, mais saudável está sua empresa.' },
          { instruction: 'O sistema dá dicas de como melhorar cada indicador.' },
          { instruction: '✅ Agora você entende seu Push Score!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-16',
    title: 'IA Gerente',
    description: 'Use inteligência artificial para gerenciar melhor.',
    icon: '🤖',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '16.1',
        title: 'Seu gerente inteligente',
        steps: [
          { instruction: 'A IA Gerente analisa sua empresa e dá recomendações.', route: '/ia-gerente' },
          { instruction: 'No "Resumo" ela mostra o diagnóstico geral.' },
          { instruction: 'No "Chat" você pode conversar e pedir análises específicas.' },
          { instruction: 'Ela identifica problemas, oportunidades e prioridades.' },
          { instruction: '✅ Agora você sabe usar a IA Gerente como aliada!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-17',
    title: 'Relatórios Inteligentes',
    description: 'Análises automáticas com IA.',
    icon: '🧠',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '17.1',
        title: 'Análises com IA',
        steps: [
          { instruction: 'Relatórios Inteligentes são gerados automaticamente pela IA.', route: '/relatorios-inteligentes' },
          { instruction: 'Análise financeira, indicadores, CMV, despesas.' },
          { instruction: 'A IA identifica oportunidades e classificações automáticas.' },
          { instruction: '✅ Agora você conhece os Relatórios Inteligentes!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-18',
    title: 'Usuários',
    description: 'Crie usuários e defina permissões.',
    icon: '👤',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '18.1',
        title: 'Gestão de usuários',
        steps: [
          { instruction: 'Aqui você cria contas para sua equipe.', route: '/usuarios' },
          { instruction: 'Clique em "Novo Usuário".' },
          { instruction: 'Defina: nome, email, senha e perfil (Administrador, Gerente ou Vendedor).' },
          { instruction: 'Cada perfil tem permissões diferentes no sistema.' },
          { instruction: '✅ Agora você sabe gerenciar usuários!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-19',
    title: 'Vendedores',
    description: 'Cadastre vendedores e gerencie comissões.',
    icon: '🏷️',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '19.1',
        title: 'Gestão de vendedores',
        steps: [
          { instruction: 'Vendedores são vinculados às vendas para controle de comissão.', route: '/vendedores' },
          { instruction: 'Clique em "Novo Vendedor".' },
          { instruction: 'Preencha nome, telefone e percentual de comissão.' },
          { instruction: 'No PDV, o vendedor poderá ser selecionado em cada venda.' },
          { instruction: '✅ Agora você sabe cadastrar vendedores!' },
        ],
      },
    ],
  },
  {
    id: 'modulo-20',
    title: 'Importação de Dados',
    description: 'Importe produtos, clientes e estoque via planilha.',
    icon: '📥',
    estimatedTime: '5 min',
    submodules: [
      {
        id: '20.1',
        title: 'Importando dados',
        steps: [
          { instruction: 'Se você já tem dados em planilhas, pode importar tudo de uma vez.', route: '/importacao' },
          { instruction: 'Escolha o que importar: Clientes, Produtos ou Estoque.' },
          { instruction: 'Baixe o modelo de planilha.' },
          { instruction: 'Preencha e faça upload.' },
          { instruction: 'O sistema valida e importa automaticamente.' },
          { instruction: '✅ Agora você sabe importar dados em massa!' },
        ],
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
  return mod.submodules.reduce((acc, sub) => acc + sub.steps.length, 0);
}
