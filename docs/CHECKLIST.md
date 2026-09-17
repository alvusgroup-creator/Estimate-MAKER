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

### 1.6 Shell do app no estilo InvoiceFly (menu, listas, settings)

O que foi **pego** da referência, o que foi **fundido** com o nosso e o que foi **cortado**:

| Decisão | Detalhe |
|---|---|
| Pego: **Invoices** no menu | Item próprio na sidebar e na barra do celular (`/invoices`, filtros All / Unpaid / Paid). Links antigos `/estimates?f=invoices` redirecionam |
| Pego: **cabeçalho do mês** nas listas | Seta ◀ ▶ troca o mês, mostra o total cotado (estimates) ou faturado (invoices) + quanto foi ganho/pago. "All time" tira o filtro; a busca ignora o mês |
| Pego: **estados vazios** com ícone e frase de ação | Estimates, Invoices, Change orders, Clients, Services, Home |
| Pego: **Settings como lista** | `/settings` vira menu (Account → Upgrade / Sign out; Business → Info, Branding, Signature, Tax & defaults, Notifications; Help → suporte). Cada linha abre a seção com seta de voltar. Links `?tab=` continuam funcionando |
| Fundido: **Upgrade to Pro** | Tabela Free vs Pro pronta (`/settings?tab=upgrade`), sem checkout — diz que está em early access e é grátis. Limites da coluna Free (3 estimates/mês, sem IA) são **proposta**, confirmar antes do Stripe |
| Fundido: **Reports** | Não criei página separada — o Home já tem os números (em aberto, ganho, win rate, a receber) |
| Cortado: microfone (voz), Despesas, Registro de tempo, Faturas recorrentes, Agenda, Criador de logo por IA | Despesas/tempo pertencem ao módulo financeiro do upsell; recorrência/agenda é o nicho de limpeza; logo por IA não ajuda a fechar obra |
| Suporte | Só aparece se `NEXT_PUBLIC_SUPPORT_EMAIL` estiver no `.env` |

Como testar: menu lateral tem Invoices · abrir `/estimates` e trocar o mês · `/invoices?f=unpaid` · `/settings` → clicar em cada linha e voltar · `/settings?tab=upgrade`.

### 1.7 Pagamentos parciais na fatura + atalho de personalização

Das telas do editor/preview da referência, ficou: **registro de pagamentos** (sinal, parcelas, final → saldo devido) e um atalho **Customize** (ícone de paleta) na página do documento que leva ao Branding, agora com paleta de cores rápidas. Cortado: microfone, tamanho de fonte, espaçamento, etiquetas personalizadas, formato de data, remover fundo do logo. Os balões "toque aqui" são o tour guiado (backlog item 9).

| Item | Como testar |
|---|---|
| Fatura tem card **Payments** com "Record payment" (valor já vem com o saldo, data, método, nota) | Abrir uma invoice → registrar R$ parcial → saldo cai, status continua aberto |
| Registrar o valor restante (ou **Mark as paid**) → status **PAID** automaticamente; apagar um pagamento reabre a fatura | — |
| "Mark as unpaid" sumiu — agora é apagar o pagamento na lista | — |
| O sinal do estimate vira um pagamento "Deposit" quando converte em fatura | Estimate com depósito → Convert to invoice → aparece na lista de pagamentos |
| Documento da fatura mostra **Paid to date** e **Balance due** (ou "Paid in full") | Ver `/e/<token>` da invoice |
| Faturas antigas foram migradas: depósito virou pagamento "Deposit"; faturas PAID ganharam pagamento "Balance" | Supabase: `select * from "Payment";` |
| Home → "Unpaid invoices" usa total − pago | — |
| Editor de fatura não tem mais campo "Deposit already paid" | — |
| Página do documento tem ícone 🎨 → Settings › Branding, com **paleta de 14 cores** de um toque | — |

### 1.8 Editor de estimate refeito (formato de documento)

Mescla do nosso editor com o da referência: uma coluna só, no formato do documento (número + datas → Cliente → Itens → Totais → Notas → Fotos → Look). O preview deixou de ficar espremido ao lado: botão **Preview** no topo abre o documento em tamanho real, com Save ali mesmo. Bugs corrigidos de quebra: **datas vazias** (dd/mm/aaaa) ao editar e o campo de imposto mostrando fração em vez de porcentagem.

| Item | Como testar |
|---|---|
| Barra fixa no topo: ← voltar · "Edit estimate" · número + total · **Preview** · **Save** | Abrir `/estimates/new` e um estimate existente em edit |
| Datas preenchidas ao editar (Date / Valid until; Due date em invoice) | Editar um estimate → as datas aparecem |
| Cliente: botão azul grande **Add client** → seletor + "New"; escolhido vira linha com avatar, contato e **Change** | — |
| Itens: nome + valor da linha na mesma linha; qty × unidade × rate embaixo; **Add item** azul; busca no price book continua | — |
| Totais: Subtotal · **+ Add discount** (só aparece o controle quando pedir) · imposto com % editável inline · **Total** grande · **+ Add deposit** | Imposto: digitar 8.25 → documento mostra 8.25% |
| Preview abre em tela cheia; **Back to edit** volta; erro de validação fecha o preview e mostra no formulário | — |
| Change order: mostra "Change order for EST-…" no topo, sem desconto/depósito/validade, e "Revised contract total" nos totais | — |

### 1.9 Seis modelos de documento (refeitos a partir das 6 referências do InvoiceFly)

| Modelo | Referência | Traço |
|---|---|---|
| **Clean** | 2 | Título grande à esquerda, logo à direita, cabeçalho da tabela em degradê, barra escura de Balance Due |
| **Bold** | 3 | Faixa colorida no topo com logo, título e número; tabela na cor da marca |
| **Classic** | 1 | Papel timbrado: logo + contato, linha grossa, nome da empresa + INVOICE, tabela escura |
| **Noir** | 4 | Faixa preta texturizada, título centralizado com a data |
| **Minimal** | 5 | Logo + nome lado a lado, tabela sem preenchimento, Balance Due em linha |
| **Executive** | 6 | Logo à esquerda, título + contato à direita, tabela azul, Balance Due grande |

Todos têm: **Payment instructions** (novo campo em Settings › Tax & estimate defaults, sai só em faturas), Comments/Notes, Terms, assinaturas (cliente à esquerda, contractor à direita), "Thank you for your business". Em faturas o rodapé de valores mostra Total → Paid → **Balance due**.

Como testar: Settings › Branding → trocar o modelo e ver o preview (miniatura real) · editor → card **Look** com 6 miniaturas · abrir `/e/<token>` no celular (não deve transbordar).

### 1.10 Preview & personalizar (no editor)

Como na referência: no **Preview** do editor tem uma régua embaixo com abas **Template** (miniaturas reais dos 6 modelos, já com os dados do documento) · **Color** (bolinhas — salva na marca na hora, vale pra todos os documentos) · **Logo** (leva ao Branding). O card **Look** do formulário também usa as miniaturas reais.

Como testar: editor → Preview → trocar modelo (muda na hora) → aba Color → escolher → "Saved to your brand" → Save → abrir outro documento: cor mantida.

### 1.11 Home refeito (no espírito da referência)

| Item | Como testar |
|---|---|
| Cartões de período **mês / ano** (clicáveis) com valor ganho e quantidade | Clicar em cada um → o número grande muda |
| Número grande = **ganho no período** (estimates aceitos); embaixo **Outstanding** em vermelho (saldo de faturas em aberto) + "N overdue" | — |
| 4 stats: Awaiting response · Unpaid invoices (vermelho se tem vencida) · Win rate · Clients — todos clicáveis | — |
| **Alertas de configuração** (estilo "Stripe incompleto"): logo, imposto, payment instructions, assinatura — só os que faltam, no máximo 2 | Preencher em Settings → somem |
| Lista **Recent** com avatar do cliente, número, valor e etiqueta **Due today / Due in 3d / Overdue 5d** em faturas | — |
| Botão grande **Create estimate** em degradê: fixo acima da barra no celular, inline no desktop | — |
| Pill **Free plan / PRO** no canto → Upgrade | — |

Cortado: microfone e a bolinha de paginação.

### 1.12 Marca: Alvus EasyInvoice

Nome fechado em 2026-09-16: **EasyInvoice, by Alvus Group**. Logo (ícone de fatura com seta amarela + "Easy" e "Invoice" no selo amarelo) recriada em vetor em `src/components/brand/logo.tsx`; favicon em `src/app/icon.svg`. Tema do app virou **preto (#0b0b0b) + amarelo Alvus (#F5C518)** — botões amarelos com texto preto, links em âmbar legível.

| Item | Como testar |
|---|---|
| Logo no login, no topo da sidebar (empresa do cliente fica logo abaixo) e no título da aba | — |
| Favicon com o ícone | Ver a aba do navegador |
| Botões principais amarelos (Create estimate, Email, Save no editor…) | — |
| E-mails: remetente "EasyInvoice" e botão "Open in EasyInvoice" | Enviar um |
| Orgs novas nascem com cor de destaque do documento amarela | Criar conta → Branding |

### 1.13 Regressão rápida (nada disso mudou, mas passa por código tocado)

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
