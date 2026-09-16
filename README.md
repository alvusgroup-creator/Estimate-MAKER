# Estimate Builder

Estimates profissionais em 2 minutos, do celular, para contractors nos EUA. Mini-CRM embutido: todo estimate precisa de um cliente, então a base de clientes cresce sozinha.

## Stack

- Next.js 16 (App Router) · TypeScript · Tailwind 4
- Supabase (Auth + Storage para logos) · Postgres via Prisma 7 (`@prisma/adapter-pg`)
- Zod + react-hook-form · print-to-PDF · Anthropic SDK (recomendações) · Vitest

## Rodar local

```bash
cp .env.example .env        # preencha DATABASE_URL, DIRECT_URL, SUPABASE_*, ANTHROPIC_API_KEY
npm install
npx prisma migrate dev --name init
SEED_USER_ID=<uuid do auth.users> npx prisma db seed
npm run dev
```

## Estrutura

```
prisma/schema.prisma          modelo de dados (multi-tenant por Organization)
prisma/seed.ts                org demo + catálogo + clientes + 1 estimate
src/lib/prisma.ts             client Prisma (singleton)
src/lib/auth.ts               requireOrg() — fronteira de tenancy; toda query filtra por orgId
src/lib/supabase/             clients server/browser
src/lib/estimates/calc.ts     matemática do estimate (única implementação, browser + server)
src/lib/estimates/schemas.ts  Zod: estimate, line item, client, service
src/lib/catalog-presets.ts    catálogo inicial oferecido no onboarding
src/lib/ai/recommend.ts       botão "AI suggestions" — contexto → output estruturado
src/app/(auth)/login
src/app/(app)/{dashboard,clients,estimates,services,settings}
src/app/e/[token]             link público do estimate (view/accept)
src/app/api/ai/recommend      POST { estimateId }
```

## Decisões

- **1 login por empresa** no MVP; `User → Organization` é 1:N para adicionar equipe depois sem migração.
- **Contractors em geral**; catálogo inicial cobre pintura, drywall, piso, exterior, landscaping.
- `currency`, `locale`, `taxLabel`, `taxConfig` no schema desde o dia 1 → Canadá/Portugal sem rewrite.
- Linhas do estimate são **snapshot** (nome/preço copiados); `serviceItemId` é só referência.
- Totais são **persistidos** ao salvar, nunca recalculados na leitura.
- Assinatura eletrônica: colunas prontas (`signerName`, `signatureDataUrl`), feature adiada.

## Roadmap

**MVP** — onboarding (logo/cores/dados) · catálogo · clientes · builder com preview ao vivo · 3 templates · PDF + link público · status Draft→Sent→Viewed→Accepted/Declined · duplicar

**v1.1** — ~~Accept no link público~~ · ~~estimate → invoice~~ · ~~recomendações IA com feedback 👍👎~~ · assinatura desenhada no aceite · Stripe (plano Pro + deposit online)

**v2** — Canadá (GST/HST, CAD) · Portugal (IVA, EUR, pt-PT) · multi-usuário
