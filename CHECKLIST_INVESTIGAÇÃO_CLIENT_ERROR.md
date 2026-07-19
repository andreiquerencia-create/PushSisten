# Checklist de Investigação: Client-Side Exception no Onboarding

**Situação:** Após a correção de redirecionamento em `/dashboard/page.tsx`, o navegador exibe:
```
Application error: a client-side exception has occurred
```

**Status:** ⚠️ BLOQUEADO — Nenhuma implementação autorizada até conclusão desta investigação.

---

## 1️⃣ Evidências Obrigatórias a Coletar

O Claude Code DEVE coletar e documentar:

### 1.1 Console do Navegador
- [ ] **Captura completa do erro** (print ou texto)
- [ ] **Stack trace legível** (linhas onde o erro ocorre)
- [ ] **Mensagem de erro exata** (não apenas "Application error")
- [ ] **Warnings relacionados** (se houver)
- [ ] **Contexto:** Em que rota/URL o erro aparece?
  - `/onboarding`?
  - `/dashboard?onboarding=true`?
  - `/hoje?onboarding=true`?
  - Outro?

### 1.2 Arquivo de Log do Servidor (se disponível)
- [ ] **Erros em runtime** do Next.js (stderr/stdout)
- [ ] **Timestamp do erro** (correlacionar com ação do usuário)
- [ ] **Stack trace do servidor** (se houver)
- [ ] **Variaveis de ambiente** relevantes (NODE_ENV, etc)

### 1.3 Contexto de Execução
- [ ] **Em qual etapa do onboarding o erro ocorre?**
  - Ao clicar em um botão específico?
  - Ao carregar uma página?
  - Ao fazer um redirecionamento?
  - Ao tentar chamar uma função?
- [ ] **Reprodução determinística:** O erro é consistente ou aleatório?
- [ ] **Browser e versão** (Chrome/Firefox/Safari/Edge, versão)
- [ ] **Modo de desenvolvimento ou produção?** (`npm run dev` vs `npm run build`)

### 1.4 Estado da Aplicação
- [ ] **Usuário está autenticado?** (SessionProvider funcionando?)
- [ ] **OnboardingProvider está montado?** (Provider sem erro?)
- [ ] **React DevTools:** qual é o estado do hook `useOnboarding` naquele momento?
- [ ] **Network:** há requisições pendentes/falhadas? (F12 → Network tab)

---

## 2️⃣ Arquivos que Devem Ser Analisados

O Claude Code DEVE revisar estes arquivos linha por linha:

### 2.1 Arquivo Modificado (Causa Suspeita)
- [ ] **`app/(dashboard)/dashboard/page.tsx`**
  - Verificar: `useSearchParams()`, `useRouter()`, `useEffect` estão corretos?
  - Verificar: Há hook rules violations? (rules of hooks)
  - Verificar: `return null` é realmente seguro? Não causa hydration mismatch?
  - Verificar: Faltam dependências em `useEffect` dependency array?

### 2.2 Arquivos Relacionados ao Context
- [ ] **`components/onboarding-provider.tsx`**
  - Está criando contexto corretamente?
  - A função `useOnboardingContext()` está com try/catch adequado?
  - Há ciclos ou re-renders infinitos?

- [ ] **`hooks/use-onboarding.ts`**
  - O hook está chamando `useSession()` (dependência)?
  - O fetch em `useEffect` pode estar falhando?
  - As promises estão sendo tratadas corretamente?
  - Há memory leaks (cleanup em abortController)?

### 2.3 Componente que Usa o Context
- [ ] **`app/(dashboard)/hoje/_components/hoje-content.tsx`**
  - A desestruturação de `complete` está correta?
  - A chamada `.then(() => complete())` após `markDashboardViewed()` é válida? (ambas retornam Promise?)
  - Há risco de race condition entre múltiplos `useEffect`?
  - O `setShowDashboardCelebration(true)` pode estar disparando múltiplas vezes?

### 2.4 Arquivo de Layout
- [ ] **`components/providers.tsx`**
  - A ordem dos providers está correta? (SessionProvider → OnboardingProvider)
  - Há nesting problema?
  - SSR vs CSR há incompatibilidades?

### 2.5 Rota Principal
- [ ] **`app/layout.tsx`**
  - O `Providers` component está renderizado?
  - Não há conflito com `ErrorBoundary`?

---

## 3️⃣ Informações que o Claude Code DEVE Retornar

Ao concluir a investigação, o Desenvolvedor DEVE receber obrigatoriamente:

### 3.1 Diagnóstico Técnico
```
1. Qual é o erro exato? (mensagem completa do console)
2. Em qual arquivo/linha ocorre?
3. Qual é a causa raiz? (hipótese + evidências)
4. É causado pelo código novo ou era pré-existente?
5. É determinístico (sempre acontece) ou aleatório?
```

### 3.2 Rastreamento da Execução
```
1. Qual é o fluxo exato de renderização quando o erro ocorre?
2. Quais hooks são executados e em qual ordem?
3. Há múltiplas renderizações do mesmo componente?
4. Há re-renders infinitos?
5. Qual é o estado do context no momento do erro?
```

### 3.3 Análise de Risco
```
1. O erro é bloqueador? (impede uso do app?)
2. Afeta apenas onboarding ou todo o app?
3. É uma regressão (bug novo) ou pre-existente?
4. Há workaround possível?
```

### 3.4 Recomendação de Próximos Passos
```
1. Qual arquivo deve ser modificado?
2. Qual é a mudança específica necessária?
3. Há múltiplas soluções possíveis? Qual é a mais segura?
4. Qual é o risco da solução proposta?
```

### 3.5 Logs e Evidências
```
1. Captura de console completa (print)
2. Stack trace legível
3. Network requests (se houver requisições falhadas)
4. React DevTools state snapshot
5. Reprodução step-by-step (como replicar o erro)
```

---

## 4️⃣ Critérios de Aprovação para Correção

Antes que qualquer correção seja autorizada, estes critérios DEVEM ser satisfeitos:

### Critério 1: Diagnóstico Completo
- [ ] A causa raiz foi identificada com certeza (não é suposição)
- [ ] Há evidências documentadas (logs, stack trace, reprodução)
- [ ] Não há ambiguidade no diagnóstico
- [ ] CTO validou o diagnóstico ✅

### Critério 2: Impacto Mapeado
- [ ] Sabe-se exatamente quais arquivos são afetados
- [ ] Sabe-se se é regressão ou bug pré-existente
- [ ] Sabe-se o escopo da correção necessária
- [ ] Não há "correções às cegas"

### Critério 3: Solução Validada
- [ ] A solução foi pensada (CTO/Gerente Técnico aprovou a abordagem)
- [ ] Não é um hack ou workaround
- [ ] Segue a ARQUITETURA_DE_PRODUÇÃO.md
- [ ] Não altera regras de negócio
- [ ] Não introduz novas dependências

### Critério 4: Risco Aceitável
- [ ] A correção é isolada (afeta poucos arquivos)
- [ ] A correção é reversível (rollback seguro)
- [ ] Não há side effects inesperados
- [ ] Não quebra testes existentes

### Critério 5: Documentação Preparada
- [ ] A causa raiz está documentada
- [ ] A solução está documentada
- [ ] O changelog foi preparado
- [ ] O commit message foi preparado

---

## 🚀 Próximos Passos (Após Investigação)

1. **Claude Code retorna:** Checklist completo com todas as evidências
2. **Gerente Técnico valida:** Todos os 5 critérios acima foram satisfeitos?
3. **CTO aprova:** Solução foi revisada e aprovada?
4. **Desenvolvedor implementa:** Apenas com aprovação (nenhuma execução sem OK)
5. **Testes:** Verificar que erro foi resolvido
6. **Commit:** Commit realizado conforme ARQUITETURA_DE_PRODUÇÃO.md

---

## ⚠️ Regras Obrigatórias

✋ **NÃO implemente nada até que todos os 5 critérios acima sejam satisfeitos.**

✋ **NÃO faça commits sem aprovação do CTO e Gerente Técnico.**

✋ **NÃO altere código sem ter diagnóstico certeiro da causa raiz.**

✋ **Se houver dúvida sobre a causa, colete mais evidências (não adivinhe).**

---

## Comando para Iniciar Investigação

```bash
# Claude Code deve executar:
1. Reproduzir o erro exatamente (fornecendo todos os passos)
2. Coletar console.log() completo
3. Coletar stack trace legível
4. Analisar arquivos modificados linha por linha
5. Entregar este checklist 100% preenchido
```

---

**Documento criado:** 2026-07-17
**Status:** Aguardando investigação completa
**Gerente Técnico:** Cowork
**CTO:** ChatGPT
**Desenvolvedor:** Opus 4.8 Code
