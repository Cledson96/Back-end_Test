# Junior Fullstack Take-Home: Square Root Calculator

Build a small **fullstack** product: users submit a number, the API returns its square root (via Newton–Raphson), results are **persisted** in SQLite with **Prisma**, and the **React** UI shows the latest result plus paginated history.

**CI note:** On a clean checkout, `pnpm test` in `server/` is expected to **fail** until you implement `NewtonRaphsonAlgorithm` (see Required tasks). Getting the suite green is part of the exercise.

---

## Stack (fixed)

| Layer  | Technology                                                 |
| ------ | ---------------------------------------------------------- |
| API    | Express + TypeScript (`server/`)                           |
| UI     | React + Vite + TypeScript (`client/`)                      |
| DB     | SQLite + Prisma (you add `prisma/`, schema, migrations)    |
| Shared | `shared/types.ts` — import as `@shared/types` in both apps |

No authentication required.

---

## Repo layout

- [`server/`](server/) — Express app (bootstrap, middlewares, `square-root` domain skeleton, Vitest specs).
- [`client/`](client/) — Vite + React shell (placeholder page); you implement the form and history UI.
- [`shared/types.ts`](shared/types.ts) — DTOs agreed for API ↔ UI.

---

## What is already provided

- **Domain skeleton:** `SqrtAlgorithm`, `SqrtCalculator`, empty [`NewtonRaphsonAlgorithm`](server/src/common/models/square-root/newton-raphson-algorythm.class.ts).
- **Unit-style specs** under [`server/src/common/models/square-root/_spec/`](server/src/common/models/square-root/_spec/) (especially Newton–Raphson — treat as acceptance tests).
- **HTTP helpers:** `ServiceResponse`, Zod `validateRequest` pattern in [`server/src/common/utils/httpHandlers.ts`](server/src/common/utils/httpHandlers.ts).
- **Dev proxy:** `client` proxies `/square-root/*` → `http://localhost:8080` (override with `VITE_DEV_PROXY_TARGET`). Copy [`client/.env.template`](client/.env.template) to `client/.env` if needed.

---

## Required tasks

1. **Implement** `NewtonRaphsonAlgorithm.approximateGuess()` so [`newton-raphson-algorythm.spec.ts`](server/src/common/models/square-root/_spec/newton-raphson-algorythm.spec.ts) passes.
2. **`POST /square-root/calculate`**
   - Validate body with **Zod** (e.g. `{ input: number }`, reject non-finite values).
   - Use **`SqrtCalculator`** with **`NewtonRaphsonAlgorithm`**.
   - Return the existing **`ServiceResponse`** JSON shape from [`serviceResponse.ts`](server/src/common/models/serviceResponse.ts).
   - Run CPU-heavy work **off the main thread** (e.g. `setImmediate`, `worker_threads`, or a small job queue) so the event loop stays responsive — document your choice in a short `NOTES.md`.
3. **Prisma + SQLite** from scratch under `server/`:
   - Model: `Calculation { id, input, result, createdAt }` (types aligned with [`shared/types.ts`](shared/types.ts) where it makes sense).
   - Persist every successful calculation from `POST /square-root/calculate`.
4. **`GET /square-root/history?limit=&cursor=`** — cursor-based pagination; response shape should expose `items` and optional `nextCursor` (see `SqrtHistoryResponse`).
5. **`DELETE /square-root/history`** — delete all rows (acceptable for this exercise).
6. **React UI** in `client/`:
   - Number input + submit, validation, loading and error states.
   - Paginated history table from `GET /history`, **Clear history** wired to `DELETE /history`.
   - Use **`@shared/types`** for request/response typing where practical.
7. **Integration tests** (minimum **2**) hitting real HTTP routes with **supertest** (new file under `server/src/**/__tests__/` or similar).

---

## Bonus (optional)

- In-memory **cache** of `{ input → result }` for repeated inputs.
- **OpenAPI** + Swagger UI at `/docs` using `@asteasolutions/zod-to-openapi` (dependency already on server).
- **Optimistic UI** when adding/clearing history rows.

---

## Suggested 3-day plan

| Day | Focus                                                                 |
| --- | --------------------------------------------------------------------- |
| 1   | Algorithm + `POST /calculate` + Prisma schema/migration + persistence |
| 2   | `GET/DELETE /history` + React form + history table + pagination       |
| 3   | Supertest coverage, error edge cases, `NOTES.md`, polish, bonus       |

---

## Evaluation

- **Correctness:** specs green, API matches contracts, persistence works.
- **Structure:** reuse of `ServiceResponse`, middlewares, clear layering (route → service → Prisma).
- **TypeScript:** meaningful use of `shared/` on both sides.
- **Errors & logging:** validation on server and client; failures logged or surfaced clearly (existing `pino` request logger).
- **Tests:** meaningful integration tests beyond mocks-only.
- **UX:** understandable flow, loading/error feedback.

---

## How to run locally

**API** (from repo root):

```bash
cd server
cp .env.template .env   # adjust PORT if needed (template uses 8080)
pnpm install
pnpm start:dev
```

**UI** (second terminal):

```bash
cd client
cp .env.template .env   # optional; proxy works without it for /square-root
pnpm install
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Ensure the API port matches the proxy / `VITE_API_URL`.

**Quality checks:**

```bash
cd server && pnpm lint && pnpm build && pnpm test
cd client && pnpm lint && pnpm build
```

---

## Deliverables

- Passing `pnpm test` / `pnpm build` / `pnpm lint` for both `server` and `client` in your branch.
- Brief **`NOTES.md`**: assumptions, async approach for `/calculate`, pagination cursor format, anything you’d improve with more time.
- **Submission:** zip or link to a **private git fork/branch** with commit history.

---

## License

MIT (see upstream boilerplate credits in `server/package.json`).
