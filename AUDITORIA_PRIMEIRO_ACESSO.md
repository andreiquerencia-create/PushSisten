# AUDITORIA COMPLETA — Experiência do Primeiro Acesso

Data: 19/07/2026
Analisado por: Co-Founder Técnico (Claude Code)
Método: Navegação real por todas as 24 telas do sistema via Chrome automatizado

---

## RESUMO EXECUTIVO

O PushSisten possui 24 módulos/telas. Para um novo cliente que acabou de contratar, a maioria dessas telas é irrelevante nos primeiros dias. O sistema hoje **não guia o usuário** — ele entra e vê um dashboard vazio que diz "faltam 30 dias e 10 vendas". Isso gera sensação de produto incompleto.

A jornada ideal do primeiro acesso deveria levar o cliente da **primeira configuração à primeira venda em menos de 10 minutos**, com tudo pré-configurado ao máximo.

---

## MÓDULOS ENCONTRADOS (24 telas)

| # | Rota | Nome | Estado Inicial |
|---|---|---|---|
| 1 | /hoje | Central do Dia | Vazio ("faltam 30 dias e 10 vendas") |
| 2 | /pdv | PDV | Funcional mas sem produtos |
| 3 | /vendas | Vendas | "Nenhuma venda encontrada" |
| 4 | /clientes | Clientes | "Nenhum cliente encontrado" |
| 5 | /estoque | Estoque | R$ 0,00 em tudo |
| 6 | /produtos | Produtos | "Nenhum produto encontrado" |
| 7 | /categorias | Categorias | "Nenhuma categoria" |
| 8 | /financeiro | Financeiro | R$ 0,00 |
| 9 | /fluxo-caixa | Previsão de Caixa | Tudo zerado |
| 10 | /crediario | Crediário | Vazio |
| 11 | /caixas | Caixas | 1 caixa criado (Caixa Principal) |
| 12 | /formas-pagamento | Formas de Pagamento | 5 formas pré-cadastradas ✅ |
| 13 | /plano-contas | Plano de Contas | Estrutura básica criada ✅ |
| 14 | /fornecedores | Fornecedores | "Nenhum fornecedor" |
| 15 | /executivo | Visão Executiva | Tudo zerado |
| 16 | /dre | DRE | Tudo zerado |
| 17 | /relatorios | Relatórios | Sem dados |
| 18 | /importacao | Importação em Massa | Wizard de importação |
| 19 | /usuarios | Usuários | 1 usuário (admin) |
| 20 | /vendedores | Vendedores | "Nenhum vendedor" |
| 21 | /ia-gerente | IA Gerente | "Loja em Formação" |
| 22 | /relatorios-inteligentes | Relatórios Inteligentes | Sem dados |
| 23 | /push-score | Push Score | Em formação |
| 24 | /configuracoes | Configurações | Dados da empresa |

---

## MÓDULOS ESSENCIAIS (primeiros dias)

Estes são os módulos que o cliente PRECISA usar para começar a operar:

| Prioridade | Módulo | Por quê |
|---|---|---|
| 1 | /configuracoes | Dados da empresa (nome, CNPJ, endereço) |
| 2 | /categorias | Organizar produtos por tipo |
| 3 | /produtos | Cadastrar o que vende |
| 4 | /clientes | Cadastrar quem compra |
| 5 | /caixas | Abrir o caixa do dia |
| 6 | /pdv | Fazer a primeira venda |
| 7 | /vendas | Conferir venda registrada |

## MÓDULOS SECUNDÁRIOS (primeira semana)

| Módulo | Por quê |
|---|---|
| /vendedores | Se tem equipe de vendas |
| /fornecedores | Se quer rastrear fornecedores |
| /importacao | Se já tem planilha com dados |
| /financeiro | Lançar despesas e entradas |
| /usuarios | Se tem mais gente usando |
| /formas-pagamento | Ajustar taxas e prazos |

## MÓDULOS AVANÇADOS (após estabilizar)

| Módulo | Por quê |
|---|---|
| /fluxo-caixa | Projeção financeira (precisa de histórico) |
| /crediario | Venda fiado (precisa de clientes e vendas) |
| /dre | Demonstrativo de resultado (precisa de dados) |
| /executivo | Visão executiva (precisa de vendas) |
| /relatorios | Relatórios (precisa de dados) |
| /estoque | Gestão avançada de estoque (precisa de produtos) |
| /plano-contas | Configuração contábil (precisa de financeiro) |
| /ia-gerente | IA (precisa de 30 dias + 10 vendas) |
| /relatorios-inteligentes | IA (precisa de histórico) |
| /push-score | Score (precisa de 30 dias + 10 vendas) |

---

## DEPENDÊNCIAS

```
Configurações (empresa)
  └── Categorias
       └── Produtos
            └── PDV (venda)
                 └── Vendas
                 └── Financeiro
                 └── Estoque
                      └── DRE
                      └── Relatórios
                      └── Executivo
                      └── Fluxo de Caixa

Clientes (pode ser paralelo a produtos)
  └── Crediário
  └── Vendas (associar cliente)

Caixas (pré-requisito para venda)
  └── PDV
  └── Financeiro

Formas de Pagamento (já vem pré-configurado ✅)
  └── PDV

Vendedores (opcional)
  └── PDV (atribuir vendedor)
  └── Relatórios (ranking)

30 dias + 10 vendas
  └── IA Gerente
  └── Push Score
  └── Relatórios Inteligentes
```

---

## JORNADA IDEAL DE IMPLANTAÇÃO

### Etapa 1 — Configurar a empresa

**Objetivo:** Definir identidade da empresa no sistema.

**Por que é importante:** Todos os comprovantes, relatórios e documentos usam esses dados.

**Pré-requisitos:** Nenhum.

**Telas envolvidas:** /configuracoes

**Ações do usuário:**
- Preencher nome da empresa
- Preencher CNPJ (se tiver)
- Preencher endereço
- Preencher telefone
- Configurar logo (opcional)

**Erros comuns:** Pular esta etapa e deixar comprovantes sem dados da empresa.

**Como saber que está concluído:** Dados da empresa preenchidos.

---

### Etapa 2 — Criar categorias

**Objetivo:** Organizar produtos para facilitar busca e relatórios.

**Por que é importante:** Sem categorias, relatórios "por categoria" ficam vazios e produtos ficam desorganizados.

**Pré-requisitos:** Nenhum.

**Telas envolvidas:** /categorias

**Ações do usuário:**
- Clicar "Nova Categoria"
- Criar 3-5 categorias iniciais (ex: Blusas, Calças, Vestidos, Acessórios)

**Erros comuns:** Criar categorias muito específicas. Melhor ser genérico no início.

**Como saber que está concluído:** Pelo menos 3 categorias criadas.

---

### Etapa 3 — Cadastrar produtos

**Objetivo:** Ter produtos para vender no PDV.

**Por que é importante:** Sem produtos, o PDV não funciona.

**Pré-requisitos:** Categorias criadas (opcional mas recomendado).

**Telas envolvidas:** /produtos, /importacao (alternativa para muitos produtos)

**Ações do usuário:**
- Clicar "Novo Produto"
- Preencher: nome, preço de venda, categoria, estoque inicial
- OU usar /importacao com planilha modelo

**Erros comuns:**
- Não colocar preço de custo (impossibilita cálculo de margem)
- Não definir estoque inicial (sistema mostra 0)
- Cadastrar um por um quando tem centenas (deveria usar importação)

**Como saber que está concluído:** Pelo menos 5-10 produtos cadastrados com preço.

---

### Etapa 4 — Cadastrar clientes (opcional no início)

**Objetivo:** Associar vendas a clientes para histórico e CRM.

**Por que é importante:** Permite rastrear compras, crediário, etiquetas (VIP, inadimplente).

**Pré-requisitos:** Nenhum.

**Telas envolvidas:** /clientes

**Ações do usuário:**
- Clicar "Novo Cliente"
- Preencher: nome, telefone (mínimo)
- OU usar /importacao com planilha modelo

**Erros comuns:** Não cadastrar clientes e perder rastreabilidade.

**Como saber que está concluído:** Pelo menos 1 cliente cadastrado.

---

### Etapa 5 — Verificar caixa e formas de pagamento

**Objetivo:** Garantir que o caixa está pronto para receber vendas.

**Por que é importante:** Sem caixa aberto, não vende. Sem formas de pagamento, não finaliza venda.

**Pré-requisitos:** Nenhum (sistema já cria Caixa Principal e 5 formas de pagamento).

**Telas envolvidas:** /caixas, /formas-pagamento

**Ações do usuário:**
- Verificar se "Caixa Principal" existe ✅ (já vem pronto)
- Verificar formas de pagamento (Boleto, Crédito, Débito, Dinheiro, PIX) ✅ já existem
- Abrir caixa do dia (botão "Abrir caixa" na /hoje)

**Erros comuns:** Não abrir o caixa antes de tentar vender.

**Como saber que está concluído:** Caixa aberto.

---

### Etapa 6 — Fazer a primeira venda

**Objetivo:** Validar que o sistema funciona ponta a ponta.

**Por que é importante:** É o momento "aha!" — o cliente vê o sistema funcionando de verdade.

**Pré-requisitos:** Produtos cadastrados + Caixa aberto.

**Telas envolvidas:** /pdv

**Ações do usuário:**
- Buscar produto pelo nome
- Clicar no produto para adicionar ao carrinho
- Selecionar cliente (opcional)
- Clicar "Pagamento"
- Escolher forma de pagamento
- Clicar "Finalizar Venda"

**Erros comuns:**
- Tentar vender sem abrir o caixa
- Não encontrar produto (esqueceu de cadastrar)
- Confusão entre "Orçamento" e "Finalizar"

**Como saber que está concluído:** Venda #00001 registrada.

---

### Etapa 7 — Conferir resultado

**Objetivo:** Ver que a venda aparece nos módulos financeiros.

**Por que é importante:** Gera confiança de que tudo está integrado.

**Pré-requisitos:** Primeira venda realizada.

**Telas envolvidas:** /vendas, /financeiro, /hoje

**Ações do usuário:**
- Ir em /vendas → ver venda listada
- Ir em /financeiro → ver entrada registrada
- Ir em /hoje → ver "Caixa do dia" atualizado

**Erros comuns:** Nenhum nesta etapa.

**Como saber que está concluído:** Venda visível em 3 módulos diferentes.

---

### Etapa 8 — Cadastrar vendedores (se aplicável)

**Objetivo:** Atribuir vendas a vendedores para comissão e ranking.

**Por que é importante:** Permite controlar quem vendeu o quê e calcular comissões.

**Pré-requisitos:** Nenhum.

**Telas envolvidas:** /vendedores

**Ações do usuário:**
- Clicar "Novo Vendedor"
- Preencher nome, telefone, % comissão

**Como saber que está concluído:** Vendedores aparecem no PDV.

---

### Etapa 9 — Explorar financeiro

**Objetivo:** Lançar despesas e acompanhar saúde financeira.

**Telas envolvidas:** /financeiro, /fluxo-caixa, /dre

**Quando faz sentido:** Após 3-5 dias de uso.

---

### Etapa 10 — Conhecer a IA Gerente

**Objetivo:** Entender o que o sistema pode fazer automaticamente.

**Telas envolvidas:** /ia-gerente, /push-score, /relatorios-inteligentes

**Quando faz sentido:** Após 30 dias + 10 vendas.

---

## PONTOS DE CONFUSÃO

| # | Problema | Onde | Impacto |
|---|---|---|---|
| 1 | Dashboard (/hoje) mostra "faltam 30 dias" para novo cliente | /hoje | Sensação de que o produto não funciona ainda |
| 2 | Módulo "Estoque" é muito avançado para quem começou | /estoque | 7 sub-abas (Executivo, Operação, Movimentações...) assusta |
| 3 | "Plano de Contas" aparece no menu para todos | /plano-contas | Terminologia contábil confusa para lojista pequeno |
| 4 | PDV exige "Abrir Caixa" mas não explica onde | /pdv | Cliente tenta vender e não consegue |
| 5 | Diferença entre "Orçamento" e "Finalizar" no PDV | /pdv | Cliente pode fazer orçamento achando que é venda |
| 6 | "Push Score" / "Saúde da Loja" sem dados | /push-score | Mostra tela vazia por 30 dias |
| 7 | Muitos módulos vazios ao mesmo tempo | Todos | Sensação de produto incompleto/vazio |
| 8 | Não existe ordem sugerida de "o que fazer primeiro" | Global | Cliente fica perdido |
| 9 | "Importação em Massa" está escondida no menu Gestão | /importacao | Quem tem 500 produtos não encontra |
| 10 | "Visão Executiva" mostra dezenas de cards zerados | /executivo | Informação demais sem valor |

---

## MELHORIAS DE UX

| # | Melhoria | Impacto | Esforço |
|---|---|---|---|
| 1 | Empty states educativos ("Cadastre seu primeiro produto para começar") | Alto | Baixo |
| 2 | Checklist de implantação visível na /hoje | Alto | Médio |
| 3 | Esconder módulos avançados até que façam sentido | Alto | Médio |
| 4 | Botão "Abrir Caixa" mais visível antes do PDV | Alto | Baixo |
| 5 | Wizard de importação como opção no primeiro acesso | Alto | Médio |
| 6 | Tooltip/dica no primeiro uso de cada módulo | Médio | Médio |
| 7 | Progress bar de implantação (0% → 100%) | Alto | Médio |
| 8 | Mensagem de parabéns na primeira venda | Médio | Baixo |
| 9 | Desabilitar relatórios/dashboards até ter dados | Médio | Baixo |
| 10 | Sugerir próximo passo em cada tela vazia | Alto | Médio |

---

## SUGESTÕES PARA UM ONBOARDING GUIADO

### Etapa 1 — Configurações
- **Tour guiado:** Highlight nos campos obrigatórios
- **Dica contextual:** "Esses dados aparecerão nos comprovantes dos seus clientes"
- **Tarefa obrigatória:** Preencher nome da empresa

### Etapa 2 — Categorias
- **Sugestão automática:** "Baseado no seu tipo de loja, sugerimos: Blusas, Calças, Vestidos, Acessórios. Quer criar todas?"
- **Botão rápido:** "Criar categorias padrão" (1 clique)

### Etapa 3 — Produtos
- **Duas opções claras:**
  - "Cadastrar manualmente" (poucos produtos)
  - "Importar planilha" (muitos produtos)
- **Dica:** "Comece com 5-10 produtos. Você pode adicionar mais depois."
- **Checklist:** Nome ✓ Preço ✓ Categoria ✓ Estoque ✓

### Etapa 4 — Clientes
- **Dica contextual:** "Você pode cadastrar clientes agora ou durante a venda"
- **Botão pular:** "Pular — vou cadastrar durante as vendas"

### Etapa 5 — Caixa
- **Ação automática:** Sistema abre o caixa automaticamente no primeiro uso
- **Ou highlight:** "Clique aqui para abrir seu caixa e começar a vender"

### Etapa 6 — Primeira Venda
- **Tour guiado no PDV:** Highlights em: buscar produto → adicionar → pagamento → finalizar
- **Conquista:** 🎉 "Parabéns! Sua primeira venda foi registrada!"
- **Barra de progresso:** "Setup completo! Você está pronto para operar."

### Barra de Progresso Global
```
[████████░░] 80% — Falta: Primeira Venda

✅ Empresa configurada
✅ Categorias criadas
✅ Produtos cadastrados
✅ Caixa aberto
⬜ Primeira venda
```

---

## RESPOSTA FINAL

**"Se você fosse responsável pelo onboarding deste SaaS, como faria um usuário chegar à sua primeira venda no menor tempo possível e com a menor chance de desistência?"**

Faria assim:

### 1. Após o signup, NÃO mostrar o dashboard vazio.

Mostrar uma tela de "Setup" com 5 passos grandes e claros:

```
┌─────────────────────────────────────────────────┐
│  Vamos colocar sua loja no ar!                   │
│                                                  │
│  ① Dados da empresa          [2 min]  ▶ Iniciar │
│  ② Cadastrar produtos        [5 min]  ▶ Iniciar │
│  ③ Abrir caixa               [30 seg] ▶ Iniciar │
│  ④ Fazer primeira venda      [2 min]  ▶ Iniciar │
│  ⑤ Explorar o sistema        [livre]  ▶ Depois  │
│                                                  │
│  [████░░░░░░] 0% concluído                       │
└─────────────────────────────────────────────────┘
```

### 2. Cada passo abre a tela correspondente com guia.

- Passo 1: /configuracoes com highlight nos campos essenciais
- Passo 2: /produtos com formulário simplificado (só nome + preço + estoque)
- Passo 3: /caixas com botão "Abrir Caixa" destacado
- Passo 4: /pdv com tour visual mostrando o fluxo

### 3. Eliminar friction:

- Categorias: criar automaticamente baseado no tipo de loja (escolhido no signup)
- Caixa: criar e abrir automaticamente
- Formas de pagamento: já vem pronto ✅
- Plano de contas: já vem pronto ✅

### 4. Tempo total estimado: 8-10 minutos

| Etapa | Tempo |
|---|---|
| Signup | 1 min |
| Dados empresa | 2 min |
| Cadastrar 5 produtos | 4 min |
| Abrir caixa | 30 seg |
| Primeira venda | 2 min |
| **Total** | **~10 min** |

### 5. Após a primeira venda:

- Mostrar dashboard com dados reais (não mais "faltam 30 dias")
- Mostrar: "Parabéns! Sua loja está operando. Aqui estão suas próximas sugestões..."
- Listar módulos secundários como "próximos passos" opcionais

### Princípio central:

**Reduzir o número de decisões que o usuário precisa tomar.**

Cada decisão é um ponto de desistência. O onboarding ideal toma as decisões pelo usuário (defaults inteligentes) e só pede confirmação.
