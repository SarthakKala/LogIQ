# LogIQ

Natural-language observability over a mock payment pipeline: ingest correlated logs and spans, persist them in PostgreSQL, track latency windows in Redis, detect statistical anomalies, and ask questions in plain English—answers are grounded in live data via OpenRouter.

---

## Architecture

```
[auth-service] ──► [fraud-service] ──► [payment-service] ──► [notification-service]
       │                  │                    │                      │
       └──────────────────┴────────────────────┴────────────────────┘
                                    │
                           POST /ingest (:4000)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
             PostgreSQL                     Redis (ioredis)
        logs, journey_metrics,           latency_window:<service>
             anomalies
                    │
             POST /ask + buildContext
                    │
                    ▼
              OpenRouter (LLM)
                    │
                    ▼
         Next.js dashboard (:3000)
      metrics · live logs · traces · chat
                    │
              WebSocket :4001
           (broadcast after ingest)
```

---

## Tech stack

| Layer | Technology | Role |
| --- | --- | --- |
| Mock services | Node.js + Express | Chained payment journey, emits spans to collector |
| Collector | Node.js + Express | Ingest, query, metrics, anomalies, `/ask`, health |
| Relational DB | PostgreSQL (e.g. Supabase) | Logs, journey metrics, anomaly rows |
| NoSQL / windows | Redis | Rolling per-service latency lists |
| Real-time | `ws` | Live log stream to the browser |
| LLM | OpenRouter | Grounded answers from DB + Redis context |
| Frontend | Next.js 14 + TypeScript + Tailwind | Dashboard, chat, trace view |
| Tests | Jest + Supertest | Unit + integration against real DB/Redis |
| Local infra | Docker Compose | **Redis only** in this repo (Postgres is hosted) |

---

## Prerequisites

- Node.js 18+
- A PostgreSQL database (this project is wired for a **Supabase** `DATABASE_URL`; any Postgres works if the URL is valid)
- Docker (for local Redis only)

---

## Setup

1. **Clone and install**

   ```bash
   cd LogIQ
   npm install
   cd frontend && npm install && cd ..
   ```

2. **Environment**

   - Copy `.env.example` → `.env` at the repo root and fill `DATABASE_URL`, `REDIS_URL`, and `OPENROUTER_API_KEY`.
   - Copy `frontend/.env.example` → `frontend/.env.local` and adjust `NEXT_PUBLIC_COLLECTOR_URL` / `NEXT_PUBLIC_WS_URL` if your collector is not on `localhost`.

3. **Redis**

   ```bash
   npm run infra:up
   ```

4. **Run everything**

   ```bash
   npm run start:all
   ```

   Then open [http://localhost:3000](http://localhost:3000). The collector listens on **4000** (HTTP) and **4001** (WebSocket).

---

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run infra:up` | Start Redis (`docker-compose up -d`) |
| `npm run infra:down` | Stop Redis stack |
| `npm run start:collector` | Collector API + migrate + WS server |
| `npm run start:services` | All four mock microservices |
| `npm run start:frontend` | Next.js dev server |
| `npm run start:all` | Collector + services + frontend (one terminal) |
| `npm test` | Jest (13 tests, real Postgres + Redis) |
| `npm run stage1` | Smoke script for ingest / health (optional) |

---

## Example questions (chat)

Try these once data is flowing (`start:services` + collector running):

1. Why did the payment journey fail in the last 30 minutes?
2. Which service has the highest latency right now?
3. Are there any active anomalies I should know about?
4. What does the summary say about success rate and average latency?
5. Which service appears most often as the top error service in metrics?

---

## Project layout (short)

| Path | Contents |
| --- | --- |
| `collector/` | Express app, `createApp`, ingest routes, `llm.js`, WebSocket broadcast |
| `collector/db/` | Postgres pool, Redis client, migrations |
| `collector/classes/` | `LogStore`, `AnomalyDetector`, `MetricsEngine` |
| `services/` | `auth`, `payment`, `fraud`, `notification` mock services |
| `frontend/` | Next.js App Router, dashboard components, `/api/ask` proxy |
| `tests/` | Jest unit + integration suites |

---

## Testing

Requires a reachable `DATABASE_URL` and `REDIS_URL` (same as dev). Migrations run in Jest `globalSetup`.

```bash
npm test
```

---

## License

Private / educational use unless you add a license file.
