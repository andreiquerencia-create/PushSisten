# PushSisten

ERP com IA para lojas de moda — atacado e varejo de roupas.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Prisma + PostgreSQL
- Tailwind CSS + Radix UI
- IA com function calling (OpenAI-compatible)

## Rodar localmente

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores.

## Estrutura

- `app/` — Páginas + API Routes
- `lib/` — Engines de domínio (regras de negócio)
- `prisma/` — Schema do banco
- `components/` — Componentes React compartilhados