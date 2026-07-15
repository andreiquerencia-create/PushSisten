/**
 * Smart Classifier — Account Plan Classification System
 * 
 * Provides keyword-based and rule-based suggestion of AccountPlan codes
 * based on transaction descriptions.
 * 
 * Keywords are normalized (lowercase, no accents) and matched against descriptions.
 */

function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Keyword rules — each entry maps:
 *  - keywords[]: an array of trigger words/phrases (already normalized)
 *  - code: the AccountPlan code (matches the seed structure)
 *  - context: 'entrada' | 'saida' | 'both' — direction filter
 * 
 * Order matters! More specific rules should come first.
 */
export interface ClassificationRule {
  keywords: string[];
  code: string;
  context: 'entrada' | 'saida' | 'both';
  label: string; // friendly label for display
}

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ====== RECEITAS (entradas) ======
  { keywords: ['venda', 'vendas', 'cliente pagou', 'receita', 'pdv'], code: '1.1', context: 'entrada', label: 'Receita Operacional' },
  { keywords: ['atacado'], code: '1.1.2', context: 'entrada', label: 'Vendas Atacado' },
  { keywords: ['varejo'], code: '1.1.1', context: 'entrada', label: 'Vendas Varejo' },
  { keywords: ['online', 'e-commerce', 'shopee', 'mercado livre', 'magalu', 'amazon'], code: '1.1.3', context: 'entrada', label: 'Vendas Online' },
  { keywords: ['marketplace'], code: '1.1.4', context: 'entrada', label: 'Marketplace' },
  { keywords: ['juros recebido', 'juros recebidos', 'juros de mora'], code: '1.3', context: 'entrada', label: 'Juros Recebidos' },
  { keywords: ['rendimento', 'rendimentos', 'aplicacao financeira'], code: '5.1', context: 'entrada', label: 'Rendimentos' },
  
  // ====== CMV — CUSTOS ======
  { keywords: ['fornecedor', 'compra mercadoria', 'compra de mercadoria', 'compra fornecedor', 'mercadoria atacado', 'compra atacado'], code: '2.1.1', context: 'saida', label: 'Compra de Mercadorias' },
  { keywords: ['frete compra', 'frete fornecedor', 'frete mercadoria'], code: '2.1.2', context: 'saida', label: 'Frete sobre Compra' },
  { keywords: ['embalagem', 'sacola', 'cabide', 'tag', 'etiqueta'], code: '2.2.1', context: 'saida', label: 'Embalagens' },
  { keywords: ['devolucao fornecedor', 'devolvido fornecedor'], code: '2.2.2', context: 'saida', label: 'Devolução a Fornecedores' },
  
  // ====== DESPESAS COMERCIAIS ======
  { keywords: ['comissao vendedor', 'comissao venda', 'comissao'], code: '3.4.1', context: 'saida', label: 'Comissão de Vendedores' },
  { keywords: ['taxa cartao', 'taxa de cartao', 'maquininha', 'stone', 'cielo', 'getnet', 'rede', 'pagseguro', 'mercado pago', 'sumup', 'safrapay'], code: '3.4.3', context: 'saida', label: 'Taxas de Cartão / Maquininha' },
  { keywords: ['desconto concedido', 'desconto cliente'], code: '3.4.6', context: 'saida', label: 'Descontos Concedidos' },
  { keywords: ['brinde', 'amostra', 'oferta brinde'], code: '3.4.7', context: 'saida', label: 'Brindes e Amostras' },
  
  // ====== DESPESAS DE MARKETING ======
  { keywords: ['meta ads', 'meta ad', 'facebook ads', 'instagram ads', 'face ads'], code: '3.3.1', context: 'saida', label: 'Meta Ads (Facebook/Instagram)' },
  { keywords: ['google ads', 'google ad', 'adwords'], code: '3.3.2', context: 'saida', label: 'Google Ads' },
  { keywords: ['tiktok ads', 'tiktok ad'], code: '3.3.3', context: 'saida', label: 'TikTok Ads' },
  { keywords: ['influencer', 'influenciador', 'parceria digital'], code: '3.3.4', context: 'saida', label: 'Influenciadores' },
  { keywords: ['marketing', 'midia social', 'midia paga', 'agencia marketing', 'publicidade', 'propaganda', 'anuncio'], code: '3.3', context: 'saida', label: 'Marketing & Vendas' },
  { keywords: ['design', 'fotografia', 'foto produto', 'ensaio fotografico'], code: '3.3.5', context: 'saida', label: 'Design e Fotografia' },
  
  // ====== DESPESAS DE INFRAESTRUTURA / FIXAS ======
  { keywords: ['aluguel', 'locacao loja', 'locacao imovel'], code: '3.1.1', context: 'saida', label: 'Aluguel' },
  { keywords: ['condominio'], code: '3.1.2', context: 'saida', label: 'Condomínio' },
  { keywords: ['iptu'], code: '3.1.3', context: 'saida', label: 'IPTU' },
  { keywords: ['energia eletrica', 'energia', 'cemig', 'enel', 'cpfl', 'coelba', 'celpe', 'light', 'eletropaulo', 'conta luz', 'luz'], code: '3.1.4', context: 'saida', label: 'Energia Elétrica' },
  { keywords: ['agua e esgoto', 'sabesp', 'cedae', 'embasa', 'conta agua', 'agua'], code: '3.1.5', context: 'saida', label: 'Água e Esgoto' },
  { keywords: ['internet', 'vivo fibra', 'oi fibra', 'tim fibra', 'claro fibra', 'wifi', 'banda larga', 'fibra'], code: '3.1.6', context: 'saida', label: 'Internet' },
  { keywords: ['telefone', 'celular empresa', 'plano celular', 'vivo movel', 'tim celular', 'claro celular', 'oi movel'], code: '3.1.7', context: 'saida', label: 'Telefonia' },
  { keywords: ['seguro loja', 'seguro estabelecimento', 'seguro patrimonial'], code: '3.1.8', context: 'saida', label: 'Seguros' },
  { keywords: ['limpeza', 'material limpeza', 'faxina', 'diarista limpeza'], code: '3.1.9', context: 'saida', label: 'Limpeza' },
  { keywords: ['seguranca', 'monitoramento', 'alarme', 'vigilancia'], code: '3.1.10', context: 'saida', label: 'Segurança' },
  
  // ====== DESPESAS COM PESSOAL ======
  { keywords: ['salario', 'folha pagamento', 'folha de pagamento', 'salarios', 'salário', 'salarios funcionarios'], code: '3.2.1', context: 'saida', label: 'Salários' },
  { keywords: ['pro-labore', 'pro labore', 'prolabore', 'pro-labor'], code: '3.2.2', context: 'saida', label: 'Pró-Labore' },
  { keywords: ['inss empresa', 'inss patronal', 'inss'], code: '3.2.3', context: 'saida', label: 'INSS Patronal' },
  { keywords: ['fgts'], code: '3.2.4', context: 'saida', label: 'FGTS' },
  { keywords: ['vale transporte', 'vt', 'passagem funcionario'], code: '3.2.5', context: 'saida', label: 'Vale-Transporte' },
  { keywords: ['vale refeicao', 'vr', 'ticket alimentacao', 'va', 'vale alimentacao'], code: '3.2.6', context: 'saida', label: 'Vale-Refeição/Alimentação' },
  { keywords: ['13 salario', '13o salario', 'decimo terceiro'], code: '3.2.7', context: 'saida', label: '13º Salário' },
  { keywords: ['ferias funcionario', 'ferias colaborador'], code: '3.2.8', context: 'saida', label: 'Férias' },
  { keywords: ['rescisao'], code: '3.2.9', context: 'saida', label: 'Rescisões' },
  { keywords: ['plano saude', 'unimed', 'amil', 'bradesco saude'], code: '3.2.10', context: 'saida', label: 'Plano de Saúde' },
  
  // ====== DESPESAS ADMINISTRATIVAS ======
  { keywords: ['contador', 'contabilidade', 'honorarios contador', 'escritorio contabil'], code: '3.5.1', context: 'saida', label: 'Contabilidade' },
  { keywords: ['advogado', 'honorario advogado', 'jurídico', 'juridico'], code: '3.5.2', context: 'saida', label: 'Honorários Advogados' },
  { keywords: ['sistema', 'software', 'erp', 'saas', 'assinatura sistema', 'mensalidade sistema'], code: '3.5.3', context: 'saida', label: 'Software / Sistemas' },
  { keywords: ['material escritorio', 'papelaria', 'caneta', 'papel'], code: '3.5.4', context: 'saida', label: 'Material de Escritório' },
  
  // ====== DESPESAS DE LOGÍSTICA / ENTREGA ======
  { keywords: ['frete entrega', 'frete cliente', 'frete pedido', 'frete envio'], code: '3.5', context: 'saida', label: 'Frete sobre Vendas' },
  { keywords: ['correios', 'sedex', 'pac'], code: '3.5.1', context: 'saida', label: 'Correios' },
  { keywords: ['motoboy', 'motoqueiro entregas'], code: '3.5.2', context: 'saida', label: 'Motoboy / Entregas' },
  { keywords: ['transportadora'], code: '3.5.3', context: 'saida', label: 'Transportadora' },
  
  // ====== IMPOSTOS ======
  { keywords: ['das', 'simples nacional', 'simples'], code: '4.1', context: 'saida', label: 'DAS (Simples Nacional)' },
  { keywords: ['icms'], code: '4.2', context: 'saida', label: 'ICMS' },
  { keywords: ['pis '], code: '4.3', context: 'saida', label: 'PIS' },
  { keywords: ['cofins'], code: '4.4', context: 'saida', label: 'COFINS' },
  { keywords: ['irpj'], code: '4.5', context: 'saida', label: 'IRPJ' },
  { keywords: ['csll'], code: '4.6', context: 'saida', label: 'CSLL' },
  { keywords: ['iss '], code: '4.7', context: 'saida', label: 'ISS' },
  { keywords: ['imposto', 'tributo', 'taxa governo'], code: '4', context: 'saida', label: 'Impostos' },
  
  // ====== RESULTADO FINANCEIRO ======
  { keywords: ['emprestimo', 'financiamento', 'parcela emprestimo'], code: '5.5', context: 'both', label: 'Empréstimos' },
  { keywords: ['juros pagos', 'juros bancarios'], code: '5.2', context: 'saida', label: 'Juros Pagos' },
  { keywords: ['multa', 'multas', 'juros mora pago'], code: '5.3', context: 'saida', label: 'Multas e Mora' },
  { keywords: ['tarifa bancaria', 'tarifa banco', 'manutencao conta', 'tarifa', 'pacote bancario'], code: '5.4', context: 'saida', label: 'Tarifas Bancárias' },
  { keywords: ['iof'], code: '5.6', context: 'saida', label: 'IOF' },
  { keywords: ['cheque devolvido'], code: '5.7', context: 'saida', label: 'Cheques Devolvidos' },
  { keywords: ['ajuste de caixa', 'ajuste caixa', 'sobra caixa', 'falta caixa', 'diferenca caixa'], code: '5.99', context: 'both', label: 'Ajuste de Caixa' },
  
  // ====== INVESTIMENTOS / CAPEX ======
  { keywords: ['equipamento', 'maquina', 'computador empresa', 'notebook empresa', 'tablet empresa'], code: '6.1', context: 'saida', label: 'Equipamentos' },
  { keywords: ['movel', 'moveis', 'mobiliario', 'cadeira', 'mesa loja'], code: '6.2', context: 'saida', label: 'Móveis e Mobiliário' },
  { keywords: ['reforma', 'obra'], code: '6.3', context: 'saida', label: 'Reformas e Obras' },
  { keywords: ['decoracao', 'vitrinismo'], code: '6.4', context: 'saida', label: 'Decoração' },
  { keywords: ['curso', 'treinamento', 'capacitacao', 'palestra'], code: '6.5', context: 'saida', label: 'Capacitação' },
  { keywords: ['veiculo', 'carro empresa', 'moto empresa'], code: '6.6', context: 'saida', label: 'Veículos' },
  { keywords: ['software desenvolvimento', 'desenvolvimento site', 'site novo'], code: '6.7', context: 'saida', label: 'Software/Desenvolvimento' },
];

/**
 * Suggests an AccountPlan code based on a description.
 * Returns: { code, label, matchedKeyword } or null
 */
export function suggestAccountPlanCode(description: string, context: 'entrada' | 'saida' = 'saida'): { code: string; label: string; matchedKeyword: string } | null {
  if (!description || description.trim() === '') return null;
  
  const normalized = normalize(description);
  
  // First pass: find ALL matches; rank by keyword length (longer = more specific)
  type Match = { rule: ClassificationRule; keyword: string };
  const matches: Match[] = [];
  
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.context !== 'both' && rule.context !== context) continue;
    
    for (const kw of rule.keywords) {
      if (normalized.includes(kw)) {
        matches.push({ rule, keyword: kw });
        break; // one match per rule is enough
      }
    }
  }
  
  if (matches.length === 0) return null;
  
  // Rank by keyword length (longer = more specific)
  matches.sort((a, b) => b.keyword.length - a.keyword.length);
  
  const best = matches[0];
  return {
    code: best.rule.code,
    label: best.rule.label,
    matchedKeyword: best.keyword,
  };
}

/**
 * Lists all rules for documentation/admin display.
 */
export function listAllRules(): ClassificationRule[] {
  return CLASSIFICATION_RULES;
}
