# Glor.IA GitHub Bridge (Next.js 14, TS)

Bridge API per operare su GitHub da un assistente AI (Glor.IA). Sicuro, tipizzato, deployabile su Vercel.

## Stack

- Next.js 14 (App Router, TypeScript)
- @octokit/rest, @octokit/app
- zod, zod-fetch
- pino, pino-pretty
- jsonwebtoken
- nanoid

## Endpoints

- `GET /api/health` → `{ status: "ok", ts }`
- `POST /api/agent/execute` → esegue azioni su GitHub (HMAC obbligatorio)
- `POST /api/github/webhook` → riceve eventi GitHub (firma X-Hub-Signature-256)
- `GET /api/openapi` → OpenAPI 3.1 JSON statico

## Sicurezza

- HMAC richiesto su `/api/agent/execute` via header `X-Signature: sha256=<hex>` calcolato sul raw body con `AGENT_SHARED_SECRET`.
- JWT opzionale: `Authorization: Bearer <JWT>` firmato con `AGENT_JWT_SECRET`.
- Allowlist repo: `REPO_ALLOWLIST` CSV di `owner/repo`.
- Rate-limit in-memory: max 60 richieste/5 min per chiave `agentId|IP`.
- Webhook GitHub: verifica `X-Hub-Signature-256` con `GH_WEBHOOK_SECRET`.

## Env richieste

- `GITHUB_MODE` = `PAT` | `APP`
- `GH_TOKEN` (se `PAT`)
- `GH_APP_ID`, `GH_APP_PRIVATE_KEY` (PEM base64), `GH_APP_INSTALLATION_ID` (se `APP`)
- `AGENT_SHARED_SECRET` (HMAC)
- `AGENT_JWT_SECRET` (opzionale)
- `REPO_ALLOWLIST` (CSV)
- `GH_WEBHOOK_SECRET` (per /api/github/webhook)
- `NODE_ENV`, `LOG_LEVEL` (default `info`)

## Avvio locale

```bash
pnpm i # o npm/yarn
pnpm dev
```

## Deploy su Vercel

- Imposta tutte le variabili d’ambiente sopra.
- Runtime Node (configurato per route handler).

## Azioni supportate (body Zod)

```ts
const ActionEnum = z.enum([
  "GET_FILE",
  "PUT_FILE",
  "CREATE_BRANCH",
  "OPEN_PR",
  "LIST_PRS",
  "MERGE_PR",
  "CREATE_ISSUE",
  "COMMENT_ISSUE",
  "ADD_LABELS",
  "SEARCH_CODE",
]);

const base = z.object({
  agentId: z.string().min(1),
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  action: ActionEnum,
});

const payloads = {
  GET_FILE: z.object({ path: z.string(), ref: z.string().default("main") }),
  PUT_FILE: z.object({
    path: z.string(),
    content: z.string(),
    message: z.string().default("chore: update via Glor.IA"),
    branch: z.string().optional(),
    baseRef: z.string().default("main"),
  }),
  CREATE_BRANCH: z.object({
    branch: z.string(),
    fromRef: z.string().default("main"),
  }),
  OPEN_PR: z.object({
    head: z.string(),
    base: z.string().default("main"),
    title: z.string(),
    body: z.string().optional(),
  }),
  LIST_PRS: z.object({
    state: z.enum(["open", "closed", "all"]).default("open"),
  }),
  MERGE_PR: z.object({
    number: z.number(),
    method: z.enum(["merge", "squash", "rebase"]).default("squash"),
  }),
  CREATE_ISSUE: z.object({
    title: z.string(),
    body: z.string().optional(),
    labels: z.array(z.string()).optional(),
  }),
  COMMENT_ISSUE: z.object({ number: z.number(), body: z.string() }),
  ADD_LABELS: z.object({
    number: z.number(),
    labels: z.array(z.string()).min(1),
  }),
  SEARCH_CODE: z.object({ q: z.string().min(3) }),
} as const;
```

## Esempi curl

Calcolo firma (bash):

```bash
BODY='{"agentId":"gloria","repo":"mea-world/glor.ia-core","action":"OPEN_PR","payload":{"head":"gloria/auto-123","title":"Glor.IA PR"}}'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$AGENT_SHARED_SECRET" -binary | xxd -p -c 256)"
curl -X POST https://<your-vercel-domain>/api/agent/execute \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  --data "$BODY"
```

## Note di sicurezza

- Nessun secret nei log.
- HMAC verificato su raw body prima del parse.
- Allowlist repo obbligatoria.
- Rate-limit leggero in-memory.

## Extra

- Commits creati da `PUT_FILE` sono firmati con autore/committer `Glor.IA Bot <gloria-bot@meaworld.com>`.
- Supporto opzionale `Idempotency-Key` per `PUT_FILE` e `OPEN_PR` con cache 5 minuti.
