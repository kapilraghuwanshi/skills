# Backend Architecture Reference

## Architecture Pattern

```
What's the scale + team size?

< 10k DAU OR solo/small team?
  → Monolith (modular monolith — clean internal boundaries, single deploy)
  → Reason: Simplicity wins. Microservices complexity not justified yet.

10k–1M DAU OR multiple teams?
  → Modular monolith → start extracting high-load services (auth, notifications)

1M+ DAU OR org-scale teams?
  → Microservices — each service owns its data, deploys independently
  → Add API Gateway + service mesh (Istio / Linkerd) for service-to-service
```

## API Design

| Style | When | NFR |
|-------|------|-----|
| REST | Default. CRUD resources, external APIs, broad client support | Maintainability |
| GraphQL | Multiple client types (web + mobile), flexible queries, avoid over-fetch | Latency (reduce round trips) |
| gRPC | Service-to-service, low latency, binary protocol, streaming | Latency p99, Throughput |
| WebSocket | Bidirectional real-time (chat, live collab, gaming) | Real-time NFR |

Use BFF (Backend for Frontend) pattern when web and mobile need different response shapes.

---

## API design: techniques and a “solid” API

**Goal:** predictable, evolvable contracts that clients and services can rely on.

**Design techniques**

- **Resource-oriented REST** — nouns (`/orders/{id}`), HTTP verbs match intent (`GET` safe, `PUT` idempotent where possible), **standard status codes** (400 vs 401 vs 403 vs 404 vs 409 vs 422 vs 429).
- **Consistency** — one error shape (`{ code, message, details }`), pagination style (`cursor` vs `offset` — pick one per API surface), date/time in **ISO-8601 UTC**.
- **Versioning** — path (`/v1/...`) or header; never break existing clients without a version bump.
- **Idempotency** — `Idempotency-Key` on creates/payments; safe retries from mobile flaky networks.
- **Documentation** — OpenAPI / contract tests generated from code or spec; example requests for each endpoint.
- **Boundaries** — **DTOs** at the edge: don’t leak DB entities; validate with schemas (Zod, Joi, etc.).

**SOLID (applied to backend services / handlers)**

| Principle | In API/service terms |
|-----------|----------------------|
| **S**ingle responsibility | One service owns one bounded context; one handler does one use-case. |
| **O**pen/closed | Extend via new endpoints or strategies, not by editing shared god-modules. |
| **L**iskov | Implementations of ports (e.g. `PaymentGateway`) honour the contract. |
| **I**nterface segregation | Clients get slim BFF responses, not fat “kitchen sink” DTOs. |
| **D**ependency inversion | Domain depends on abstractions; infra (DB, queue) implements them. |

**“Perfect” is iterative** — ship a **minimal** consistent API, measure client errors and latency, evolve with versioning.

## Database Decision Tree

```
Does wrong data cost money? (payments, inventory, bookings, auth)
  → YES → PostgreSQL / MySQL
           ACID transactions, strong consistency, foreign keys
           Avoid if: write throughput > 50k RPS (then shard or switch)

Is data document-shaped or schema changes often?
  → YES → MongoDB
           Flexible schema, horizontal scaling, eventual consistency
           Watch: no joins, careful with transactions

Is scale massive + write throughput critical? (IoT, events, timeseries)
  → YES → Cassandra / DynamoDB
           Linear horizontal scale, eventual consistency, no joins
           Design around access patterns upfront

Do you need both? (e.g. user data + activity feed)
  → Polyglot: PostgreSQL for core entities + DynamoDB/Redis for high-volume reads
```

## Caching Strategy

```
Read-heavy? Apply caching aggressively.

Layer 1 — CDN cache       Static assets, public API responses (TTL minutes–hours)
Layer 2 — Redis cache     Session data, computed feeds, expensive query results
Layer 3 — DB read replica Offload read queries from primary DB

Cache invalidation patterns:
  → Write-through: update cache on every write (consistency > performance)
  → Write-behind: async cache update (performance > consistency)
  → TTL-based: let it expire (simple, ok for non-critical data)
  → Event-driven: invalidate on Kafka event (best for microservices)

Redis use cases:
  - Session storage
  - Rate limiting counters
  - Leaderboards (sorted sets)
  - Pub/Sub for real-time
  - Distributed locks
  - Hot data cache (DAU feeds, trending content)
```

## Async Messaging

```
Write-heavy OR need to decouple services?
  → Kafka (default for scale)
     - Durable, replayable, high throughput
     - Partitioned by key for ordering guarantees
     - Consumer groups for parallel processing
     - Use for: events, audit logs, data pipelines, fanout

Simpler queue needs? (task queue, job processing)
  → SQS (AWS) / Cloud Tasks (GCP)
     - At-least-once delivery
     - Dead letter queue for failed messages
     - Use for: email sending, image processing, notifications

Low latency pub/sub within a service?
  → Redis Pub/Sub
     - Not durable (fire and forget)
     - Use for: real-time notifications, cache invalidation signals
```

## Read vs Write Heavy Patterns

### Read-Heavy System
```
- CDN for static + semi-static content
- Redis cache in front of DB
- Read replicas (1 primary write, N replica reads)
- Denormalise for read performance (store computed values)
- Elasticsearch for search (don't query DB for full-text search)
- Pre-compute expensive aggregations (cron job or event-driven)
```

### Write-Heavy System
```
- Kafka to absorb write bursts (queue writes, process async)
- Write to cache first, sync to DB async (write-behind)
- DB sharding: partition data by user_id / tenant_id / geography
- Avoid synchronous joins on write path — keep writes thin
- Batch inserts where possible (bulk API, Kafka consumer batching)
- Time-series DB for high-frequency metrics (InfluxDB / TimescaleDB)
```

### Real-Time System
```
- WebSocket server (stateful — needs sticky sessions or Redis adapter)
- Event sourcing: store events not state (rebuild state from events)
- CQRS: separate read model from write model
- Kafka for event streaming between services
- Redis Pub/Sub for lightweight fan-out
```

## Resilience Patterns

```
Circuit Breaker
  → If downstream service fails N times → open circuit → return fallback response
  → Use: Resilience4j (Java), opossum (Node), or service mesh (Istio)
  → Prevents cascade failures

Retry with Exponential Backoff
  → Retry: 1s → 2s → 4s → 8s (+ jitter to avoid thundering herd)
  → Set max retries (3) + timeout (don't retry forever)
  → Only retry idempotent operations

Timeout
  → Every external call must have a timeout (never wait forever)
  → Set per-tier latency budget: API 200ms, DB 50ms, AI 2000ms

Fallback Response
  → If service unavailable → return cached / degraded / default response
  → Example: recommendations fail → return popular items (not an error)

Bulkhead
  → Isolate thread pools per dependency
  → Slow DB doesn't block all API threads

Rate Limiting
  → Token bucket / sliding window per user / IP / API key
  → Return 429 with Retry-After header
  → Protect expensive endpoints (AI calls, file uploads)
```

## Reliability

```
Graceful Degradation
  → Core features work even if non-core features fail
  → Example: search works even if recommendations are down

Health Checks
  → /health → liveness (is the process alive?)
  → /ready  → readiness (is the service ready to receive traffic?)
  → K8s uses these to route/restart pods

Idempotency
  → All write endpoints should be idempotent (safe to retry)
  → Use idempotency keys for payments / order creation

Data Validation
  → Validate at the API boundary (never trust client input)
  → Zod / Joi / class-validator for schema validation
```

## Consistency

```
Strong Consistency (SQL):
  → ACID transactions (Atomicity, Consistency, Isolation, Durability)
  → Use for: payments, inventory, bookings, auth, anything financial
  → Postgres default isolation: Read Committed (bump to Serializable for critical)

Eventual Consistency (NoSQL):
  → CAP theorem: choose Availability + Partition tolerance
  → Use for: social feeds, likes, view counts, recommendations
  → Conflict resolution: Last-Write-Wins, vector clocks, CRDTs

Replication:
  → Synchronous: primary waits for replica ack (consistency, slight latency cost)
  → Asynchronous: primary doesn't wait (performance, risk of data loss on crash)
  → Quorum writes: write to N/2+1 replicas before ack (balance)
```

## Security

```
Auth:
  → User-facing:        OAuth 2.0 + OIDC → JWT access tokens (short TTL 15min)
                         Refresh tokens (httpOnly cookie, long TTL)
  → Service-to-service: mTLS (mutual TLS) — both sides verify certificates
  → Enterprise:         SSO via SAML 2.0 / OIDC (Okta, Azure AD)

API Security:
  → Input validation on every endpoint
  → Parameterised queries (never string concat SQL)
  → CORS: whitelist origins explicitly
  → Secrets: AWS Secrets Manager / HashiCorp Vault (never in env files or code)

Data:
  → At rest: AES-256 encryption (managed by cloud KMS)
  → In transit: TLS 1.3 minimum
  → PII: hash or encrypt at field level (bcrypt for passwords, never MD5)
```

---

## When to Skip — Opinionated Anti-Patterns

### Skip Kafka when:
- DAU < 100k AND write volume < 1k messages/sec → use SQS / BullMQ instead
- Team has no Kafka ops experience → operational burden kills velocity
- You need simple task queues (email, image resize) → SQS is 10x simpler
- Budget is tight at MVP stage → Kafka MSK starts at $200+/mo

### Skip Microservices when:
- Team < 5 engineers → network overhead + deployment complexity outweighs benefit
- DAU < 100k → monolith with clean module boundaries is faster to ship
- No clear service boundaries yet → premature split creates distributed monolith (worst of both worlds)
- Start: modular monolith → extract only when a specific service has different scale needs

### Skip MongoDB when:
- Data has clear relationships (users → orders → products) → joins are painful in Mongo
- You need transactions (payments, inventory) → Mongo multi-doc transactions are slower and complex
- Team knows SQL → learning curve + no benefit for most apps

### Skip Redis when:
- DAU < 5k → DB queries are fast enough, caching adds infra complexity
- Data changes every request → cache hit rate will be near 0%, cache is wasted

### Skip GraphQL when:
- Single client type (web only, no mobile) → REST is simpler and sufficient
- Team unfamiliar with it → caching (no CDN for POST), N+1 queries, tooling overhead
- Simple CRUD API → GraphQL flexibility not worth the complexity

### Skip gRPC when:
- Public-facing API → browser support is limited without grpc-web proxy
- Small team → Protobuf schemas + codegen adds overhead vs REST

### Skip Read Replicas when:
- DAU < 50k → primary DB handles read load fine
- Write-heavy workload → replicas don't help if bottleneck is writes

### Skip Elasticsearch when:
- Search is simple (exact match, few fields) → PostgreSQL full-text search is sufficient
- DAU < 50k → Postgres handles search well up to this scale
- Elasticsearch starts at $50+/mo managed + significant query complexity