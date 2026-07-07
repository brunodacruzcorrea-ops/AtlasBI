# ATLAS BI

Dashboard comercial da NIADCON — centro de comando de vendas com ranking, metas, cadastros e gráficos de produção.

## Run & Operate

- `pnpm --filter @workspace/atlas-bi run dev` — frontend React/Vite (porta configurada via `PORT`)
- `pnpm --filter @workspace/api-server run dev` — servidor Express da API
- `pnpm run typecheck` — typecheck completo de todos os pacotes
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks e schemas Zod a partir do spec OpenAPI
- `pnpm --filter @workspace/db run push` — aplicar mudanças no schema do banco (dev only)
- Required env: `DATABASE_URL` — string de conexão PostgreSQL; `SESSION_SECRET` — segredo para tokens de auth

## Credenciais padrão

- **Email:** admin@niadcon.com.br
- **Senha:** atlas2024

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18, Vite, Tailwind CSS, Recharts, Framer Motion, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validação: Zod (zod/v4), drizzle-zod
- Codegen de API: Orval (spec OpenAPI)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/atlas-bi/src/pages/` — páginas do dashboard (login, dashboard, ranking, consultants, sales, goals)
- `artifacts/atlas-bi/src/components/auth-provider.tsx` — contexto de autenticação + setAuthTokenGetter
- `artifacts/atlas-bi/src/components/layout/shell.tsx` — sidebar e layout principal
- `artifacts/api-server/src/routes/` — rotas da API (auth, consultants, sales, goals, dashboard)
- `lib/api-spec/openapi.yaml` — especificação OpenAPI (source of truth)
- `lib/db/src/schema/` — schema Drizzle (users, consultants, sales, goals)

## Cores da marca

- Azul escuro: #0A1F44 (sidebar, fundo principal)
- Laranja: #F47920 (destaque, CTAs, badges)
- Branco: #FFFFFF

## Architecture decisions

- Auth por token Bearer (localStorage `atlas_token`) + `setAuthTokenGetter` registrado na inicialização do app
- Senhas com SHA-256 + salt estático (adequado para demo; produção deve usar bcrypt)
- Tokens em memória no servidor (Map); produção deve usar Redis/DB sessions
- Dashboard summary/ranking/chart são endpoints dedicados agregados no servidor, nunca no cliente

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Após qualquer mudança no `lib/api-spec/openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen` E depois `pnpm run typecheck:libs`
- O servidor precisa de `DATABASE_URL` e `SESSION_SECRET` no ambiente
- Tokens de auth ficam em memória; reiniciar o servidor faz todos os usuários precisarem logar novamente
