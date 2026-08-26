# Migração do Atlas BI para a Cloudflare

Runbook da migração de Railway → Cloudflare, preservando a estrutura do monorepo.

## Arquitetura

| Peça | Hoje (Railway) | Depois (Cloudflare) |
| --- | --- | --- |
| Frontend (`artifacts/atlas-bi`) | serviço `@workspace/atlas-bi`, domínio `atlas.niadcon.com.br` | Worker `atlas-bi` (Static Assets) |
| API (`artifacts/api-server`) | serviço `@workspace/api-server` | Worker `atlas-api-server` + Container |
| Postgres | serviço `Postgres` | **permanece no Railway** |

O banco continua no Railway por decisão explícita: a Cloudflare não tem Postgres
gerenciado, e o schema Drizzle (`lib/db`) usa `drizzle-orm/node-postgres` com o
driver `pg` sobre TCP. Manter o banco onde está evita migração de dados e
qualquer mudança de schema. O Railway já expõe um proxy TCP público
(`DATABASE_PUBLIC_URL` / `RAILWAY_TCP_PROXY_DOMAIN`), que é como o container na
Cloudflare vai alcançá-lo.

## Pré-requisitos

Estes passos exigem credenciais e não podem ser feitos pelo agente.

1. **Plano Workers pago.** Cloudflare Containers não roda no plano gratuito.
2. **Zona `niadcon.com.br` na Cloudflare.** Necessária para apontar
   `atlas.niadcon.com.br` e `api.atlas.niadcon.com.br` para os Workers.
3. **Token de API.** Criar em Cloudflare → My Profile → API Tokens, com permissões
   de `Workers Scripts:Edit`, `Workers R2 Storage:Edit` (registro de imagens) e
   `Account Settings:Read`.
4. **Secrets e variáveis no GitHub** (Settings → Secrets and variables → Actions):
   - Secret `CLOUDFLARE_API_TOKEN`
   - Secret `CLOUDFLARE_ACCOUNT_ID`
   - Variable `VITE_API_URL` — URL pública da API. **Entra no bundle em tempo de
     build**, não em runtime: trocar a URL exige novo build + deploy do front.
   - Variable `CLOUDFLARE_DEPLOY_ENABLED` = `true` — os dois workflows ficam
     dormentes até esta variável existir. É o último passo a dar: sem ela nada
     é publicado na Cloudflare por engano; com ela, todo push no `main` que
     toque os caminhos observados publica.

## Passo a passo

### 1. Secrets da API no Worker

```bash
cd artifacts/api-server

# Use o DATABASE_PUBLIC_URL do serviço Postgres do Railway — NÃO o DATABASE_URL
# privado: `*.railway.internal` só resolve dentro da rede do Railway e é
# inalcançável a partir da Cloudflare.
pnpm exec wrangler secret put DATABASE_URL

# Mesmo valor já usado no Railway. Se mudar, os tokens de sessão emitidos
# antes deixam de validar (HMAC em src/routes/auth.ts).
pnpm exec wrangler secret put SESSION_SECRET
```

### 2. Primeiro deploy da API

```bash
cd artifacts/api-server && pnpm exec wrangler deploy
```

Publica em `https://atlas-api-server.<subdominio>.workers.dev`. O primeiro deploy
demora alguns minutos enquanto a Cloudflare provisiona a imagem do container.

Smoke test:

```bash
curl -i https://atlas-api-server.<subdominio>.workers.dev/api/healthz   # espera {"status":"ok"}
```

### 3. Liberar a origem do front no CORS

Enquanto o DNS não virou, o front roda em `*.workers.dev`, que não casa com o
allowlist de produção. Sem isso o front carrega mas nenhuma chamada de API passa.

```bash
cd artifacts/api-server
pnpm exec wrangler secret put EXTRA_CORS_ORIGINS   # https://atlas-bi.<subdominio>.workers.dev
pnpm exec wrangler deploy
```

Remover essa variável depois do cutover.

### 4. Deploy do frontend

Defina a variable `VITE_API_URL` no GitHub apontando para a URL da API do passo 2
e rode o workflow **Deploy Web to Cloudflare Workers**, ou localmente:

```bash
cd artifacts/atlas-bi
VITE_API_URL="https://atlas-api-server.<subdominio>.workers.dev" pnpm run build
pnpm exec wrangler deploy
```

### 5. Validação antes do cutover

Com o site ainda em produção no Railway, valide em `*.workers.dev`:

- [ ] Login funciona (`POST /api/auth/login`)
- [ ] Dashboard, Ranking, Consultores, Vendas, Metas e Usuários carregam dados
- [ ] **F5 direto em `/dashboard` devolve a página** (fallback SPA)
- [ ] Notificações de venda em tempo real chegam (SSE, `/api/events/sales`)
- [ ] Upload/exibição de fotos de consultores

O SSE é o item de maior risco: é uma conexão longa passando por Worker →
Durable Object → Container. Teste deixando a aba aberta alguns minutos.

### 6. Cutover de DNS

Só depois que a checklist acima passar inteira.

1. Descomente `routes` em `artifacts/api-server/wrangler.jsonc`
   (`api.atlas.niadcon.com.br`) e faça deploy.
2. Atualize a variable `VITE_API_URL` para `https://api.atlas.niadcon.com.br`.
3. Descomente `routes` em `artifacts/atlas-bi/wrangler.jsonc`
   (`atlas.niadcon.com.br`).
4. No Railway, **remova o custom domain** `atlas.niadcon.com.br` do serviço
   `@workspace/atlas-bi` — enquanto ele existir, a Cloudflare não consegue
   reivindicar o hostname.
5. Rode o workflow do front para reconstruir com a URL definitiva da API.
6. Remova o `EXTRA_CORS_ORIGINS` do passo 3.

### 7. Desativar o Railway

Só depois de alguns dias estável. **Não desligue o serviço `Postgres`** — ele
continua sendo o banco de produção. Desative apenas `@workspace/atlas-bi` e
`@workspace/api-server`.

## Rollback

Reapontar `atlas.niadcon.com.br` para o serviço do Railway (o custom domain e o
`workspaceatlas-bi-production.up.railway.app` continuam existindo até o passo 7).
Como o banco nunca sai do Railway, não há perda nem divergência de dados —
rollback é só DNS.

## Riscos conhecidos

- **Sessões em memória.** `tokenStore` em `src/routes/auth.ts` é um `Map` no
  processo. `max_instances: 1` mantém uma instância só, mas **todo deploy da API
  desloga todos os usuários**. Já era assim no Railway; a migração não piora,
  mas também não resolve. Persistir sessão no Postgres é a correção real.
- **Sem escala horizontal.** `max_instances: 1` é o que preserva o
  comportamento de sessão acima. Subir esse número quebra o login até que as
  sessões saiam da memória.
- **Latência do banco.** O container vai falar com o Postgres pelo proxy TCP
  público do Railway, não mais pela rede interna. Vale medir; se incomodar,
  Hyperdrive na frente ou mover o banco resolvem.
- **`mockup-sandbox` não builda sem `PORT` e `BASE_PATH`.** O `vite.config.ts`
  dele exige essas variáveis, definidas pelo workflow do Replit. Isso faz
  `pnpm run build` na raiz falhar fora do Replit. Não afeta o que é publicado:
  Railway e os workflows daqui buildam `atlas-bi` e `api-server` direto.
- **Vínculo usuário↔consultor é por e-mail.** Não existe chave estrangeira
  entre as tabelas; a associação usada para decidir quem vê qual meta
  individual compara os e-mails. Rode
  `pnpm --filter @workspace/scripts run check-links` para ver quem não casa.
