# LogIQ

LogIQ is an observability system built around a mock payment pipeline. Four microservices — auth, fraud, payment, and notification — chain together on every transaction and send their logs and timing data to a central collector. That collector stores everything in PostgreSQL, tracks per-service latency in Redis, detects anomalies when something slows down unexpectedly, and streams live updates to a dashboard. The interesting part: you can ask plain English questions about what's happening in your system and get answers grounded in real data, not guesses.

---

## 🛠️ Technologies

- Node.js + Express (Collector + Mock Services)
- Next.js 14 + TypeScript + Tailwind (Frontend Dashboard)
- PostgreSQL via Supabase (Logs, journey metrics, anomaly storage)
- Redis + ioredis (Rolling per-service latency windows)
- WebSocket (ws) (Live log streaming to the browser)
- OpenRouter API (LLM-powered natural language querying)
- Jest + Supertest (Unit and integration tests)
- Docker Compose (Local Redis setup)

---

## ✨ Features

- Four chained mock microservices simulate a real payment journey — every request flows auth → fraud → payment → notification and emits spans at each step
- A central collector ingests all logs and spans, stores them in PostgreSQL, and updates Redis latency windows in real time
- Statistical anomaly detection fires when a service's latency crosses its baseline — anomalies are stored and surfaced on the dashboard automatically
- Live log stream via WebSocket — every new ingest broadcasts to the browser instantly, no polling
- Natural language chat — ask "which service has the highest latency right now?" or "why did payment fail in the last 30 minutes?" and get answers built from live DB and Redis context, not hallucinated responses
- Full trace view — see the complete call chain for any journey, with timing per hop
- 13 Jest tests covering unit and integration scenarios against a real PostgreSQL and Redis instance
- One command startup — `npm run start:all` brings up collector, all four services, and the frontend together

---

## 🔍 The Part That Makes It Useful

Most observability tools show you logs. LogIQ lets you talk to them. The `/ask` endpoint pulls live context from PostgreSQL and Redis — current anomalies, recent metrics, top error services, latency summaries — and sends that as grounding context to the LLM alongside your question. The model never makes things up because it can only answer from what the database actually contains right now.

---

## 🔧 Process

The starting point was a specific question: what does observability actually look like from the inside? Most developers use observability tools but never build one. I wanted to understand the full pipeline — how logs get correlated across services, how metrics get aggregated, and how anomaly detection works at a basic level.

The collector was the first thing I built. It needed to accept spans from multiple services simultaneously, tag each one with a journey ID so logs from different services could be correlated to the same request, and persist everything in a structured way. PostgreSQL handles the durable storage. Redis handles the rolling latency windows because you don't need permanent storage for a 60-second sliding window — you just need fast reads and writes.

Anomaly detection was simpler than it sounds at this scale. Each service maintains a rolling window of recent latency values in Redis. When a new span comes in, the collector compares it against the rolling average. If it's significantly above baseline, it writes an anomaly record to PostgreSQL and the dashboard picks it up on the next refresh.

The natural language layer came last. The insight was that the LLM doesn't need to be smart — it just needs the right context. The `buildContext` function queries the DB and Redis for current state before every `/ask` call and prepends that data to the prompt. The model reads the actual numbers and generates a human-readable answer from them.

---

## 📚 What I Learned

- **Distributed tracing fundamentals** — how a single trace ID propagates across a chain of services and why correlated logs are more useful than isolated ones
- **Redis for time-series windows** — using Redis lists as a rolling buffer for latency values per service, with automatic trimming to keep only the last N entries
- **WebSocket broadcasting** — how to push live events to connected browser clients after each ingest without the client polling
- **Grounded LLM responses** — how to prevent hallucination by building a context payload from real DB state before every LLM call, so the model answers from data not training memory
- **Jest integration testing** — writing tests that run against a real PostgreSQL and Redis instance, with migrations in the global setup step
- **Multi-service local orchestration** — running four microservices, a collector, and a frontend together cleanly from a single npm script

---

## 🌱 Overall Growth

LogIQ changed how I think about backend systems. Every production system eventually needs to answer the question "what is happening right now and why?" — and building the infrastructure to answer that question from scratch made the concept of observability very concrete. Logs, traces, metrics, and alerts are not just features you add at the end. They are the system telling you about itself.

---

## 🚀 Running the Project

```bash
git clone https://github.com/SarthakKala/LogIQ.git
cd LogIQ

npm install
cd frontend && npm install && cd ..

# Copy and fill environment variables
cp .env.example .env
# Add: DATABASE_URL, REDIS_URL, OPENROUTER_API_KEY

cp frontend/.env.example frontend/.env.local
# Add: NEXT_PUBLIC_COLLECTOR_URL, NEXT_PUBLIC_WS_URL

# Start Redis locally
npm run infra:up

# Start everything together
npm run start:all
```

Frontend: http://localhost:3000
Collector API: http://localhost:4000
WebSocket: http://localhost:4001

Once running, open the dashboard and fire some transactions. Then try asking the chat:
- "Which service has the highest latency right now?"
- "Are there any active anomalies?"
- "Why did the payment journey fail in the last 30 minutes?"

---

## 🧪 Running Tests

```bash
npm test
# 13 tests — unit + integration against real PostgreSQL and Redis
# Make sure DATABASE_URL and REDIS_URL are set before running
```

<!--

## 🎥 Video

-- Attach your demo video here -->