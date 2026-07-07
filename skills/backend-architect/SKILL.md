---
name: backend-architect
description: Backend architecture selection and cross-language fix playbooks. Use when starting a backend, choosing stack/database/architecture, designing APIs, or diagnosing and fixing backend bugs and performance issues in any language (Node, Python, Go, Java, PHP, Rust, C#, Ruby).
---

# backend-architect

## Stack selection matrix (recommend, then justify in one line)
| Project type | First pick | Alternative | Database |
|---|---|---|---|
| CRUD SaaS / MVP | Node + NestJS or Python + FastAPI | Django (batteries incl.) | Postgres |
| Realtime (chat, live, collab) | Node (ws) or Elixir/Phoenix | Go | Postgres + Redis pub/sub |
| Data/ML-heavy API | Python + FastAPI | — | Postgres + object storage |
| High-throughput services | Go | Rust (only if perf-critical) | Postgres / ScyllaDB |
| Enterprise / strict typing | Java Spring Boot / C# .NET | Kotlin + Ktor | Postgres / SQL Server |
| Mobile-first backend | Supabase/Firebase → migrate to FastAPI/NestJS at scale | — | Postgres (Supabase) |
| E-commerce/CMS | Laravel (PHP) or Medusa (Node) | Django | MySQL/Postgres |

Defaults unless told otherwise: **monolith first** (modular), Postgres, Redis for cache/queues, REST + OpenAPI (GraphQL only for many-client aggregation needs), JWT access + refresh rotation, S3-compatible storage, Docker, GitHub Actions CI.

Scale triggers — don't microservice early: split a service only when (a) independent scaling proven necessary, (b) team >8 devs on one deploy, or (c) clearly separable domain with its own data.

## API design rules
- Nouns in paths, plural (`/users/:id/orders`); verbs only for actions (`/orders/:id/cancel`).
- Version from day one (`/v1`). Paginate every list (cursor > offset). Consistent error shape: `{error: {code, message, details}}`.
- Idempotency keys on payment/creation endpoints. Rate-limit public endpoints. Validate at the edge (zod / pydantic / DTOs) — never trust input.

## Diagnosis → auto-fix playbooks (any language)
Work order: **reproduce → read the actual error → locate → minimal fix → regression test.** Never guess-fix.

**N+1 queries** (symptom: list endpoint slow, query log shows repeats)
→ Fix: eager load (`include`/`select_related`/`prefetch_related`/`JOIN FETCH`/Eloquent `with()`), or batch with a dataloader.

**Memory leak** (RSS grows, restarts "fix" it)
→ Node: unremoved listeners, global caches without TTL — heap snapshot diff. Python: module-level mutable state, unclosed sessions. Java: static collections, threadlocal leaks — heap dump + MAT. Go: goroutine leaks — `pprof`, ensure contexts cancelled.

**Slow endpoint**
→ Measure first (APM/`EXPLAIN ANALYZE`). Order of suspicion: missing index → N+1 → serializing huge payload → sync I/O in hot path → missing cache. Add index for any WHERE/ORDER BY column on tables >10k rows.

**Race conditions / double-processing**
→ DB-level: unique constraints + `SELECT ... FOR UPDATE` or optimistic version column. Queue consumers: idempotent handlers keyed on message ID.

**Connection exhaustion** (`too many connections`, pool timeout)
→ Pool sized `(cores*2)+spindles` per instance; serverless → use a pooler (PgBouncer/RDS Proxy); always release/close in finally blocks.

**Blocking the event loop** (Node/Python async)
→ CPU work off the loop: worker threads / `run_in_executor` / job queue (BullMQ, Celery, Sidekiq). Any request handler doing >50ms CPU is a bug.

**5xx after deploy**
→ Check in order: pending migrations, env vars/secrets, dependency lockfile drift, breaking change in API contract. Roll back first if user-facing, then fix forward.

**Auth bugs**
→ Never hand-roll crypto/sessions. Token expiry mismatch, clock skew, missing refresh rotation, cookies without `Secure/HttpOnly/SameSite` — check these four before anything exotic.

## Security baseline (apply automatically to any fix)
Parameterized queries only; hash passwords with bcrypt/argon2; secrets from env/manager never code; escape output (XSS); CORS allowlist not `*`; dependencies audited (`npm audit`, `pip-audit`, `govulncheck`); least-privilege DB user.

## Observability minimum
Structured logs (JSON) with request ID; error tracking (Sentry); `/health` endpoint; latency+error-rate dashboards before you need them.
