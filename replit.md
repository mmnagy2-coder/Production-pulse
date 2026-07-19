# Production Pulse

A dual-purpose film production management and student teaching tool built for filmmaker/lecturer Mostafa Nagy. Students start in September 2026.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Wouter (routing), TanStack Query, Tailwind CSS, shadcn/ui |
| Auth | Replit-managed Clerk (email + password) |
| API | Express 5, TypeScript, OpenAPI spec → Orval codegen |
| Database | PostgreSQL + Drizzle ORM |
| AI | Anthropic Claude (script breakdown, schedule warnings, AD call-sheet review) |

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
- `artifacts/production-pulse/src/pages/` — One page file per route + stages/ folder

## Five production stages

1. **Development** — AI script breakdown + manual scene editing
2. **Pre-Production** — Shoot day scheduling, call sheets, AI AD review
3. **Production** — Digital slate (clapperboard), take logging
4. **Post-Production** — Review cuts with pinned comments
5. **Delivery** — Deliverables kanban

## Development commands

```bash
# Run codegen after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema after editing schema files
pnpm --filter @workspace/db run push

# Restart both workflows after code changes
# Use the Replit workflow panel
```

## User preferences

- Deep red accent (#C41E3A), serif headings (Playfair Display), paper-white cards
- Mobile-friendly throughout (especially Production stage)
- Evidence log is immutable — never delete entries
- Teach Mode toggle in later task (#4)
- AI provider: Anthropic (ANTHROPIC_API_KEY secret)
