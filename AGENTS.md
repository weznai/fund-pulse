# AGENTS.md

## Project overview

Fund Pulse — a Vue 3 + Express monolith for tracking Chinese mutual funds. Single repo, two apps (frontend and backend), sharing one package.json.

## Commands

```bash
npm run dev          # Vite dev server only (port 5173, proxies /api → localhost:3010)
npm run server       # Express backend only (port 3010, via tsx)
npm run dev:full     # Both concurrently (use this for normal development)
npm run build        # vue-tsc typecheck + vite build → server/dist/
npm test             # Jest (--passWithNoCoverage)
```

No separate lint or format command. `npm run build` runs `vue-tsc` which is the typecheck.

## Architecture

**Frontend** (`src/`): Vue 3 + TypeScript + Vite + Pinia + Vue Router + ECharts. Path alias `@` → `src/`.

**Backend** (`server/`): Express + better-sqlite3, run via `tsx`. Three-layer structure:
- `routes/` — HTTP handlers (also act as controllers)
- `services/` — business logic
- `db/` — data access, all re-exported through `server/db/index.ts` (barrel file)
- `external/` — third-party API integrations (东方财富)
- `scheduled/` — cron-like tasks (settlement at 18:00, estimate updates)

**Database**: SQLite (`db/fund-data.db`), WAL journal mode. Schema seed in `db/fund-data.sql`, migrations in `db/migrations/`. Connection via `server/db/connection.ts`.

**Production**: Vite builds to `server/dist/`. Express serves those static files and falls back to `index.html` for SPA routing.

## Key conventions

- **ESM throughout** (`"type": "module"`). All server imports must use `.js` extension: `import { foo } from './db.js'`.
- `server/db.ts` is a thin re-export barrel → `server/db/index.ts`. Import from either; the barrel is the canonical path used by routes/services.
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`.
- Server uses `AsyncLocalStorage` (`userContext`) to propagate user identity through the request lifecycle. See `server/db/connection.ts`.
- Admin routes protected by `validateAdminToken` middleware. Auth uses email OTP (SMTP configured via env).
- External fund data fetched from 东方财富 (EastMoney) API — see `server/external/eastmoney.ts`.

## Environment

Copy `.env.example` to `.env`. Required for production; most values have dev defaults. Production will refuse to start with default secrets (`JWT_SECRET`, `ADMIN_PASSWORD`).

## Tests

Jest (`@jest/globals`). Tests live in `server/__tests__/` and test utility functions only (input sanitization, SQL security). No database integration tests. Run with `npm test`.

## Watch out for

- The `tsconfig.json` `include` only covers `src/` — the server TypeScript files in `server/` are **not** checked by `vue-tsc` (build command). The server runs raw `.ts` via `tsx` without prior type checking.
- Build output goes to `server/dist/`, **not** the repo root.
- `db/*.db` files are gitignored (but `db/*.sql` is kept). Don't accidentally commit the database.
- The `nul` and `dev/` entries in root are gitignored artifacts — ignore them.

## 编码要求
- 修改任意代码都需要注意关联影响，代码质量，避免代码重复