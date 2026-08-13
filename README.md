# Production Pulse

A dual-purpose film production management and student teaching tool built for filmmaker/lecturer Mostafa Nagy. Students start in September 2026.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Wouter (routing), TanStack Query, Tailwind CSS, shadcn/ui |
| Auth | Supabase Auth (email + password) |
| API | Express 5, TypeScript, OpenAPI spec → Orval codegen |
| Database | Supabase PostgreSQL + Drizzle ORM |
| AI | Anthropic Claude (script breakdown, schedule warnings, AD call-sheet review) |
| Hosting | Netlify — static SPA + the Express API as a single Function |

## Monorepo layout

```
artifacts/
  production-pulse/   React-Vite frontend (routes: /)
  api-server/         Express API server (routes: /api/*)
lib/
  api-spec/           openapi.yaml + Orval config (generates api-client-react and api-zod)
  api-client-react/   Generated TanStack Query hooks
  api-zod/            Generated Zod validators
  db/                 Drizzle schema + migrations
```

## Key files

- `lib/api-spec/openapi.yaml` — Single source of truth for all API endpoints
- `lib/db/src/schema/` — One schema file per domain (projects, scenes, shootDays, takes, reviewCuts, deliverables, evidenceLog)
- `artifacts/api-server/src/routes/` — One route file per domain
- `artifacts/api-server/src/middlewares/requireAuth.ts` — The single auth chokepoint (Supabase JWT, demo cookie, test bypass)
- `artifacts/production-pulse/src/pages/` — One page file per route + stages/ folder

## Five production stages

1. **Development** — AI script breakdown + manual scene editing
2. **Pre-Production** — Shoot day scheduling, call sheets, AI AD review
3. **Production** — Digital slate (clapperboard), take logging
4. **Post-Production** — Review cuts with pinned comments
5. **Delivery** — Deliverables kanban

## Local development

Requires Node >= 22 and pnpm (see `packageManager` in `package.json`).

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in your Supabase credentials, then apply the
schema:

```bash
pnpm --filter @workspace/db run migrate
```

Run the two servers in separate terminals:

```bash
cd artifacts/api-server && PORT=8080 pnpm run dev
```

```bash
cd artifacts/production-pulse && LOCAL_API_PROXY_TARGET=http://localhost:8080 pnpm run dev
```

The frontend calls `/api` on its own origin; `LOCAL_API_PROXY_TARGET` makes Vite
forward those to the API server, mirroring what Netlify's redirect does in production.

### Other commands

```bash
# Run codegen after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

```bash
# Generate a migration after editing schema files
pnpm --filter @workspace/db run generate
```

```bash
# API end-to-end tests (boots its own server on port 4099)
pnpm run test:e2e
```

## Deployment

Netlify builds via `netlify.toml`: the SPA is published from
`artifacts/production-pulse/dist/public`, and `/api/*` is redirected to a single
Function wrapping the Express app. Because the redirect is a same-origin proxy, the
frontend's relative `/api` paths and the demo-session cookie work unchanged.

Required Netlify environment variables:

| Var | Notes |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** string (port 6543), not the direct connection |
| `SUPABASE_URL` | Used by the API to fetch the JWKS for token verification |
| `VITE_SUPABASE_URL` | Same value, baked into the client bundle |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key |
| `ANTHROPIC_API_KEY` | Optional — AI routes degrade gracefully without it |
| `NODE_ENV` | `production` |

Add the deployed site URL to Supabase under Authentication → URL Configuration
(Site URL and Redirect URLs).

## Conventions

- Deep red accent (#C41E3A), serif headings (Playfair Display), paper-white cards
- Mobile-friendly throughout (especially Production stage)
- Evidence log is immutable — never delete entries
- AI provider: Anthropic (`ANTHROPIC_API_KEY`)
- Demo mode (`pp_demo_session` cookie) is a no-signup path independent of auth
