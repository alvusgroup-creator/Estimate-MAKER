# Checklist — o que foi feito, como testar, e o que vem

Atualizado em 2026-09-16. Commits desta rodada: `8f25a6d`, `35b57e5`, `8f27ab7`.

---

## 1. O que foi feito (testar tudo de uma vez)

### 1.1 Infra de testes + limpeza (`8f25a6d`)

| Item | Como testar |
|---|---|
| Vitest instalado, 14 testes da matemática do estimate (`src/lib/estimates/calc.test.ts`) | `npm test` → deve mostrar `14 passed` |
| `@react-pdf/renderer` removido (não era usado; -51 pacotes) | `npm run build` passa; imprimir um estimate (`/e/<token>?print=1`) continua funcionando |
| `@types/node` 20 → 22 (exigência do Vitest) | `npm run build` passa |
| `CLAUDE.md` escrito com comandos + arquitetura | — |

### 1.2 Feedback 👍👎 na revisão de IA (`35b57e5`)

| Item | Como testar |
|---|---|
| Painel "AI review" mostra "Was this useful?" com 👍 👎 após as sugestões | Abrir um estimate → **Review** → aparecem sugestões → clicar 👍 ou 👎 → texto muda para "Thanks for the feedback" e botões travam |
| Grava `feedback = 1 / -1` em `AiRecommendation` | No Supabase: `select id, feedback from "AiRecommendation" order by "createdAt" desc limit 5;` |
| "Run again" reseta o feedback | Clicar **Run again** → botões voltam a ficar ativos |
| Modelo padrão agora é Haiku (igual ao `.env.example`) quando `AI_MODEL` não está setado | Conferir coluna `model` na mesma query |

### 1.3 Assinatura desenhada no aceite público (`8f27ab7`)

| Item | Como testar |
|---|---|
| No link `/e/<token>` de um estimate **SENT**, ao clicar **Accept estimate** aparece o campo de nome + canvas "Sign here with your finger" | Abrir no **celular** (é o cenário principal) e no desktop |
| Assinatura é **opcional** — nome digitado continua obrigatório | Aceitar só com o nome → funciona. Aceitar com nome + desenho → funciona |
| Botão **Clear** aparece só depois de desenhar | Desenhar → Clear → canvas limpa |
| Documento mostra a imagem desenhada no bloco "Customer signature"; sem desenho, mostra o nome em cursiva (como antes) | Depois de aceitar, recarregar `/e/<token>` e também abrir o estimate no app |
| Rodapé do bloco mostra `Nome · Accepted <data>` | Idem |
| Evento ACCEPTED registra `drawn: true/false` | Supabase: `select metadata from "EstimateEvent" where type='ACCEPTED' order by "createdAt" desc limit 3;` |
| Settings → "Your signature" continua funcionando (foi refatorado pra usar o mesmo canvas) | Settings → desenhar → Save → aparece como "Prepared by" no estimate. Testar também o modo **Type** |
| Altura do canvas em tela pequena | Conferir no celular que o canvas não fica gigante nem minúsculo |

### 1.4 Change orders (adendo ao orçamento aceito)

O diferencial de construction: o cliente pediu algo a mais no meio da obra → o contractor cria um change order, o cliente aprova (assina) pelo link, e o valor entra na fatura. Pode ser negativo (crédito por escopo removido).

| Item | Como testar |
|---|---|
| Botão **Change order** aparece no topo e no painel de um estimate **ACCEPTED** (e no menu do botão direito) | Abrir um estimate aceito → clicar → abre o editor em modo change order (cliente, endereço e imposto já vêm do orçamento; sem desconto/depósito/validade) |
| Número vira `EST-1001-CO1`, `-CO2`… | Salvar → conferir o número no topo |
| Rate **negativa** = crédito | Adicionar uma linha com rate `-300` → total fica negativo/abatido; o documento mostra "Credit" em vez de "Change total" |
| Documento mostra "Original estimate · Previously approved changes · This change order · Revised contract total" | Ver o preview no editor e a página `/e/<token>` |
| Cliente aprova pelo link (nome + assinatura opcional), igual ao estimate | Copiar link → abrir anônimo → **Accept change order** |
| Card **Change orders** no estimate original lista os COs com status e mostra **Revised total** (só soma os aceitos) | Voltar no estimate pai |
| **Convert to invoice** inclui as linhas dos change orders aceitos (prefixo `EST-1001-CO1:`) e recalcula os totais | Aceitar o CO → converter o estimate pai → conferir a fatura |
| Filtro **Change orders** na lista de estimates | `/estimates?f=changes` |
| E-mails falam "change order" | Enviar por e-mail / aceitar pelo link com `RESEND_API_KEY` |
| Testes: `npm test` → 16 passed (2 novos de crédito negativo) | — |

Limitações conhecidas: se a fatura já foi criada antes do CO ser aceito, ela não é atualizada sozinha (edite a fatura). Duplicar um CO cria outro CO no mesmo estimate.

### 1.5 Login + onboarding no estilo InvoiceFly

Layout em duas colunas (foto à esquerda, ação à direita), wizard de 3 passos com barra de progresso e tela final "Account created!" mostrando um estimate real com o nome/logo do cliente.

| Item | Como testar |
|---|---|
| `/login?mode=signup` → "Try Estimate Builder for free", opções **Google** e **Email**; pill no canto superior direito alterna Sign in / Create account | Abrir deslogado |
| Clicar **Email** expande o formulário no lugar; "Other options" volta | — |
| **Google** precisa ser ligado no Supabase (Authentication → Providers → Google, com client ID/secret do Google Cloud e redirect `https://<projeto>.supabase.co/auth/v1/callback`). Sem isso o botão mostra um erro amigável | Depois de configurar: login com Google → cai em `/onboarding` (novo) ou `/dashboard` |
| Onboarding passo 1: **Business name** (obrigatório) | Criar conta nova |
| Passo 2: **Your trade** — busca + lista (General contractor, Painting, Flooring, Drywall…). A escolha define o catálogo inicial (ex.: Painting só recebe itens de pintura/drywall/labor) | Escolher "Painting" → depois em **Services** conferir que não veio cerca/deck |
| Passo 3: **Add your logo** (opcional, sobe pro bucket `logos` na hora) — botão vira "Continue" com logo, "Skip for now" sem | — |
| Tela final: check azul + "Account created!" + preview do estimate com o nome/logo escolhidos → **Start estimating** | — |
| Seta de voltar funciona entre os passos; a barra de progresso enche por passo | — |
| Campo `trade` salvo na org | Supabase: `select name, trade from "Organization" order by "createdAt" desc limit 3;` |

Fotos são do Unsplash (URLs em `src/components/auth/split-shell.tsx`) — trocar por fotos próprias antes do lançamento. Apple e "Comece como convidado" da referência ficaram de fora (Apple exige conta de desenvolvedor Apple; convidado exige login anônimo — ambos possíveis depois).

### 1.6 Regressão rápida (nada disso mudou, mas passa por código tocado)

- Criar estimate → Send → abrir link público → status vira VIEWED → e-mail de notificação chega (se `RESEND_API_KEY` setado)
- Declinar pelo link público com motivo
- Imprimir / salvar PDF pelo link público

---

## 2. Próximo: Stripe — decisões que preciso de você

Antes de codar, 3 decisões:

**A. Depósito online — Connect ou link simples?**
- **Stripe Connect (Express)** — o dinheiro cai direto na conta do contractor; você pode cobrar uma taxa de plataforma (ex.: 1%). Contractor faz onboarding no Stripe (5 min). Mais trabalho (~2 dias), é o modelo "de verdade".
- **Só plano Pro, sem depósito** — mais simples (~½ dia). Depósito fica pra depois.

Recomendação: **Connect**, porque "aceitar e já pagar o sinal" é o que diferencia do PDF por WhatsApp.

**B. Preço do plano Pro e o que fica grátis**
- Sugestão: Free = 3 estimates/mês, sem IA. Pro = ilimitado + IA + depósito online, US$ 29/mês.
- Preciso do valor e se quer anual com desconto.

**C. Trial?** 14 dias sem cartão é o padrão para esse público.

### O que eu faço assim que decidir

1. `Organization.plan` já existe (enum `Plan`) → adicionar `stripeCustomerId`, `stripeSubscriptionId`, `stripeAccountId` (Connect), `planExpiresAt` + migration
2. Rota `/api/stripe/webhook` (checkout completo, subscription atualizada/cancelada, payment_intent do depósito)
3. Settings → aba **Billing**: botão "Upgrade to Pro" (Checkout) + "Manage subscription" (Customer Portal)
4. Settings → **Payments**: onboarding Connect + status da conta
5. Link público: botão **Pay deposit** quando o estimate está ACCEPTED e tem `depositAmount > 0` → Checkout com `transfer_data.destination` → ao pagar, evento `DEPOSIT_PAID` + e-mail ao contractor
6. Gate de plano: `requirePro()` no `requireOrg()` para IA e para criar estimate acima do limite Free
7. Testes: matemática da taxa de plataforma, e um teste do handler de webhook com payloads gravados

---

## 3. Direção do produto (anotado 2026-09-16)

- **Um app por nicho.** Este aqui é o de **construction** (GC, pintura, drywall, piso, exterior, landscaping). Outros nichos (ex.: limpeza, HVAC, beleza) ganham um clone próprio depois — não vamos colocar seletor de nicho dentro deste código.
- Consequência prática: catálogo inicial, textos, templates e prompt da IA podem falar a língua da obra sem medo de "genérico demais".

## 4. Outras coisas que posso fazer (ordem sugerida)

| # | Item | Esforço | Por que |
|---|---|---|---|
| 1 | **Deploy** Vercel + Supabase prod (checklist de env vars, domínio no Resend, `NEXT_PUBLIC_APP_URL`) | pequeno | Sem isso nada acima chega em cliente |
| 1b | **Domínio próprio no Supabase Auth** (`auth.seudominio.com`) — hoje a tela do Google mostra `xgjsbkotntiwtwwxhsaz.supabase.co`. Precisa do plano Pro (US$ 25/mês) + add-on custom domain (US$ 10/mês); depois trocar o redirect URI no Google Cloud. Também pedir a **verificação do app OAuth** no Google (grátis, exige política de privacidade publicada) pra sumir o aviso "app não verificado" | pequeno | Decidido em 2026-09-16: fazer só no lançamento, junto com o deploy |
| 2 | Rate limiter em Redis/Upstash | pequeno | O atual é em memória — some com mais de uma instância na Vercel |
| 3 | Lembrete automático: estimate SENT sem resposta em X dias → e-mail ao cliente (com cron da Vercel) | médio | Aumenta taxa de aceite sem trabalho do contractor |
| 4 | Testes do fluxo de aceite público (`/e/[token]/actions.ts`) com Prisma mockado | médio | É a parte com mais regra de negócio e zero cobertura |
| 5 | Dashboard: funil (Sent → Viewed → Accepted) + valor em aberto | médio | O contractor vê se está perdendo por preço ou por não abrir |
| 6 | Exportar clientes/estimates em CSV | pequeno | Pedido comum de quem migra de planilha |
| 7 | Canadá (GST/HST, CAD) — schema já pronto, falta UI de país no onboarding + presets de tax | médio | Roadmap v2 |
| 8 | Multi-usuário (convidar membro da equipe) | grande | Roadmap v2; schema já é N:1 |
| 9 | **Tour guiado no primeiro login** — pop-up step-by-step (ex.: "1. Configure sua marca → 2. Adicione um cliente → 3. Crie seu primeiro estimate → 4. Envie o link"), com progresso salvo na org e opção de pular. Diferente do `/onboarding` atual, que só coleta dados da empresa | médio | Pedido do Felipe em 2026-09-16 |
| 10 | Auditoria de segurança dos server actions (`/security-review`) antes do deploy | pequeno | Todo action deve passar por `requireOrg` e filtrar por `organizationId` |

Me diga as decisões do item 2 (A, B, C) e eu começo pelo Stripe; se preferir, faço o item 3.1 (deploy) antes, que destrava você testar tudo isso em produção.
