# Automações Comerciais — Arquitetura Consolidada (P6 + P7)

Este documento descreve como o módulo de **Automações** funciona após a consolidação
da Prioridade 7. A regra de ouro: **a UI consome a fila oficial; nada é inventado em
paralelo e nenhuma mensagem é enviada automaticamente nesta fase.**

## Fontes da verdade

| Entidade | Papel | Observações |
|---|---|---|
| **`AutomationAction`** (`automation_actions`) | **Fila oficial** de ações | Gerada pela IA Gerente a partir dos Insights + Push Score. Idempotente por `(companyId, date, type, reference)`. |
| **`Automation`** (legado) | **Configuração** do lojista | Liga/desliga categorias (preferência). **Não executa nada.** |
| **`ActivityLog`** (`action='automation_run'`) | **Telemetria** oficial | Registra cada geração (contadores, última execução). |
| **`AutomationLog`** (legado) | Morto / não usado | Mantido apenas para não quebrar scripts de cleanup/reset-data. |

> "Executar" uma ação = **marcar status + registrar timestamp/log**. Não há envio real
> de WhatsApp/e-mail (fase futura). Não existe executor paralelo das regras legadas.

## Fluxo

```
Vendas/Estoque/Crediário/Financeiro
        │
        ▼
Insights Engine + Push Score  ──►  IA Gerente (generateExecutiveSummary)
        │
        ▼
Automation Engine (lib/automation-engine.ts)
   buildPlannedActions(summary)  →  upsert idempotente em AutomationAction
        │
        ▼
UI /automacoes (aba "Fila de ações")  ◄── GET /api/automation/queue + /stats
   Executar/Ignorar  ──►  PATCH /api/automation/[id]
   Gerar do dia      ──►  POST  /api/automation/run
```

## Tipos de ação (6)
`ALERTA_INTERNO` · `CLIENTE_INATIVO` · `COBRANCA_CREDIARIO` · `PRODUTO_PARADO` · `ESTOQUE_BAIXO` · `RELATORIO_GERENCIAL`

## Status (4)
`PENDENTE` · `EXECUTADO` · `IGNORADO` · `ERRO`

## Endpoints

- `GET /api/automation/queue` — fila da empresa logada. Params: `status`, `type`, `limit`. Retorna `{ total, byType, bySeverity, actions }`.
- `POST /api/automation/run` — gera as automações do dia (idempotente, sem envio real). Respeita `EM_FORMACAO` → zero ações.
- `PATCH /api/automation/[id]` — atualiza status (`EXECUTADO|IGNORADO|ERRO|PENDENTE`). Valida `companyId` (bloqueia cross-tenant).
- `GET /api/automation/stats` — contadores reais: `byStatus`, `totalActions`, `totalRuns`, `lastRun`, `lastRunBy`.
- `GET/POST/PUT/DELETE /api/automacoes` — **configuração legada** (preferências on/off). Sem campos fake.

Todos os endpoints usam `getServerSession(authOptions)`, escopam por `companyId` e declaram `export const dynamic = 'force-dynamic'`.

## UI (`/automacoes`)

- **Aba "Fila de ações"**: cards-resumo com contadores reais, filtros (status + tipo), lista priorizada (ALTO primeiro), botões Executar/Ignorar, mensagem sugerida (`payload.mensagemSugerida`), rastreabilidade (`insightCode`, referência, impacto Push Score).
- **Aba "Configurações"**: preferências de categoria do lojista (liga/desliga). Não dispara execução.

## Compatibilidade de vocabulário

`lib/automation-engine.ts` exporta `LEGACY_TRIGGER_TO_INSIGHT` mapeando os 10 gatilhos
do construtor legado para os códigos de insight oficiais. É **apenas documentação/rótulo**
— a geração real continua 100% baseada em `INSIGHT_TO_AUTOMATION`.

## Homologação

- `scripts/test-automation-homologacao.ts` — P6 (50/50 PASS).
- `scripts/test-automation-p7-homologacao.ts` — P7 (59/59 PASS): A/B/C/D + idempotência + multiempresa + transições de status + filtros de fila + stats + integração Insights/Push Score + legado como config.

Rodar: `export $(grep -v '^#' .env | grep -v '^$' | xargs) && npx tsx scripts/test-automation-p7-homologacao.ts`
