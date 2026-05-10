# Database Architecture Reference

---

## CAP Theorem — As a Decision Tool

CAP says a distributed system can only guarantee **2 of 3**:

```
C — Consistency    Every read gets the most recent write (or an error)
A — Availability   Every request gets a response (not guaranteed to be latest)
P — Partition Tolerance  System works even when nodes can't talk to each other
```

**P is not optional in practice.** Networks fail. You always need partition tolerance.
So the real choice is: **CP vs AP**.

```
CP (Consistency + Partition Tolerance)
  → Prioritise correctness over availability
  → If nodes can't agree, return an error rather than stale data
  → Use when: wrong data costs money (payments, inventory, auth)
  → Examples: PostgreSQL, MySQL, MongoDB (with majority write concern), etcd

AP (Availability + Partition Tolerance)
  → Prioritise uptime over correctness
  → If nodes can't agree, return the best available answer (may be stale)
  → Use when: stale data is acceptable (feeds, likes, recommendations)
  → Examples: Cassandra, DynamoDB (default), CouchDB, Redis
```

### Practical CAP Cheat Sheet

| Data type | Wrong data consequence | Choose |
|-----------|----------------------|--------|
| Payment / balance | User overcharged or double-charged | **CP** |
| Inventory count | Oversell (100 users buy last item) | **CP** |
| User auth / session | User accesses another account | **CP** |
| Social feed / timeline | User sees post from 2s ago | **AP** |
| Like / view counts | Count is off by a few | **AP** |
| Product recommendations | Slightly stale is fine | **AP** |
| Chat messages | Message ordering matters | **CP** |
| User profile (name, bio) | Stale for a few seconds ok | **AP** |
| Search index | Slightly stale is fine | **AP** |

---

## Database Selection Guide

### Decision Tree

```
Is data relational? (users → orders → items, foreign keys matter)
  → YES + needs transactions → PostgreSQL ✅
  → YES + read-heavy, less write → PostgreSQL + read replicas

Is data document-shaped? (nested JSON, schema changes often)
  → Small-medium scale → MongoDB
  → Large scale, simple access patterns → DynamoDB

Is data a simple key-value? (sessions, cache, flags, counters)
  → Redis (in-memory, fast) OR DynamoDB (persistent, cheap at scale)

Is data time-series? (metrics, IoT, logs, events with timestamps)
  → TimescaleDB (PostgreSQL extension, familiar SQL)
  → InfluxDB (purpose-built, good free tier)

Is data a graph? (social network, recommendations, fraud detection)
  → Neo4j (mature, Cypher query language)
  → Only use if relationships ARE the query (not just joins)

Do you need full-text search?
  → < 50k DAU → PostgreSQL full-text search (built-in, free)
  → > 50k DAU → Elasticsearch / OpenSearch / Typesense
```

---

## Database Recommendations by Use Case

### 🟢 PostgreSQL — Default choice for most apps

**Use when:** relational data, transactions, ACID compliance needed
**Skip when:** DAU > 1M with extreme write throughput (then shard or switch)

**Free tiers:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| Supabase | ✅ Free forever | 500MB DB, 2 projects, pauses after 1 week inactivity |
| Neon | ✅ Free forever | 0.5GB storage, autoscales to 0, no pause |
| Railway | ✅ $5 credit/mo | Enough for hobby projects |
| Render | ✅ Free (90 days) | Then $7/mo |
| Aiven | ✅ Free trial | 30 days |

**Best free pick:** Neon (no sleep, branching for dev/staging, serverless)
**Production pick:** AWS RDS / Supabase Pro / PlanetScale (MySQL-compatible)

**Scaffold in 30 seconds:**
```bash
# Local (Docker)
docker run --name pg -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres

# With Prisma ORM
npx prisma init
# Edit schema.prisma → npx prisma migrate dev

# With Drizzle ORM
npm install drizzle-orm pg
# Define schema → npx drizzle-kit push
```

---

### 🟡 MongoDB — Flexible documents, fast schema iteration

**Use when:** content-heavy apps, catalogs, CMS, schema changes frequently
**Skip when:** relational data with joins, financial transactions, team knows SQL well

**Free tiers:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| MongoDB Atlas | ✅ M0 free forever | 512MB, shared cluster, no VPC peering |
| Railway | ✅ $5 credit/mo | Hobby use |

**Best free pick:** MongoDB Atlas M0 (official, always free, UI is excellent)

**Scaffold in 30 seconds:**
```bash
# Local (Docker)
docker run --name mongo -p 27017:27017 -d mongo

# With Mongoose (Node.js)
npm install mongoose
# mongoose.connect('mongodb://localhost:27017/mydb')

# With Prisma (MongoDB provider)
# datasource db { provider = "mongodb" url = env("DATABASE_URL") }
```

**CAP:** AP by default (eventual consistency). Use `writeConcern: majority` for CP behaviour on critical writes.

---

### 🔵 Redis — Cache, sessions, real-time, queues

**Use when:** caching hot data, sessions, rate limiting, pub/sub, leaderboards, job queues
**Skip when:** primary DB (not durable by default), complex queries, DAU < 5k (overkill)

**Free tiers:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| Upstash | ✅ Free forever | 10k commands/day, 256MB |
| Redis Cloud | ✅ Free forever | 30MB (tiny, dev only) |
| Railway | ✅ $5 credit/mo | Small apps |

**Best free pick:** Upstash (serverless Redis, HTTP API, works on edge/serverless functions)

**Scaffold in 30 seconds:**
```bash
# Local (Docker)
docker run --name redis -p 6379:6379 -d redis

# Node.js with ioredis
npm install ioredis
# const redis = new Redis({ host: 'localhost', port: 6379 })

# Node.js with Upstash (serverless)
npm install @upstash/redis
# const redis = new Redis({ url: '...', token: '...' })
```

**CAP:** AP (in-memory, fast, fire-and-forget by default). Enable AOF/RDB for persistence.

---

### 🟠 DynamoDB — Massive scale key-value / document

**Use when:** >1M DAU write-heavy, simple access patterns known upfront, AWS-native stack
**Skip when:** complex queries, joins, team unfamiliar with NoSQL access pattern design, early stage

**Free tier:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| AWS DynamoDB | ✅ Free forever | 25GB storage, 25 WCU + 25 RCU (on-demand ~200M req/mo) |

**Best free pick:** AWS free tier is genuinely generous — good for production at low scale.

**Scaffold:**
```bash
# Local (Docker — DynamoDB Local)
docker run -p 8000:8000 amazon/dynamodb-local

# Node.js
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# With Architect (IaC + local dev)
npm install -g @architect/architect
arc init my-app
```

**CAP:** AP by default. Use `ConsistentRead: true` for CP on read operations (slightly slower, more expensive).

---

### 🔴 Cassandra / ScyllaDB — Extreme write throughput

**Use when:** IoT, event streams, time-series at massive scale (>10M writes/day), globally distributed writes
**Skip when:** DAU < 500k, team unfamiliar with CQL, need ad-hoc queries or joins

**Free tiers:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| DataStax Astra | ✅ Free forever | 10GB, 40M ops/mo (Cassandra-compatible) |
| ScyllaDB Cloud | ✅ Free trial | 30 days |

**Scaffold:**
```bash
# Local (Docker)
docker run --name cassandra -p 9042:9042 -d cassandra

# Node.js
npm install cassandra-driver
```

**CAP:** AP. Tunable consistency — `QUORUM` for balance, `LOCAL_QUORUM` for multi-region.

---

### 🟣 Typesense / Meilisearch — Search-optimised

**Use when:** full-text search, fuzzy search, faceted filtering, autocomplete
**Skip when:** < 50k DAU (PostgreSQL full-text is enough), Elasticsearch already in stack

**Free tiers:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| Typesense Cloud | ✅ Free forever | 1 node, 1GB RAM |
| Meilisearch Cloud | ✅ Free (14 days) | Then self-host for free |
| Algolia | ✅ Free tier | 10k search requests/mo |

**Best free pick:** Self-host Meilisearch (Docker, dead simple, fast, open source)
**Managed pick:** Typesense Cloud (free single node, great DX)

**Scaffold:**
```bash
# Meilisearch (Docker)
docker run -p 7700:7700 getmeili/meilisearch

# Node.js
npm install meilisearch
# const client = new MeiliSearch({ host: 'http://localhost:7700' })
# await client.index('products').addDocuments(docs)
```

---

### ⚫ TimescaleDB — Time-series on PostgreSQL

**Use when:** metrics, monitoring data, IoT sensor readings, financial tick data
**Skip when:** data isn't primarily time-ordered, team doesn't know PostgreSQL

**Free tiers:**
| Provider | Free Tier | Limits |
|----------|-----------|--------|
| Timescale Cloud | ✅ Free 30 days | Then $29/mo |
| Self-host | ✅ Free forever | PostgreSQL extension, run on any server |

**Scaffold:**
```bash
# Docker (PostgreSQL + TimescaleDB extension)
docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass timescale/timescaledb:latest-pg16

# SQL
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE metrics (time TIMESTAMPTZ NOT NULL, value DOUBLE PRECISION);
SELECT create_hypertable('metrics', 'time');
```

---

## Polyglot Pattern — When to Use Multiple DBs

```
Don't use one DB for everything at scale. Use the right DB for each access pattern.

Common combinations:

E-commerce:
  PostgreSQL   → orders, users, inventory (transactional, CP)
  Redis        → cart, sessions, flash sale counters (fast, AP)
  Elasticsearch → product search (full-text, AP)

Social platform:
  PostgreSQL   → user accounts, auth (CP)
  Cassandra    → activity feed, timeline (write-heavy, AP)
  Redis        → online presence, counters (real-time, AP)
  Neo4j        → follow graph, recommendations (graph queries)

SaaS product:
  PostgreSQL   → all core data (single DB simplicity wins at <500k DAU)
  Redis        → cache, sessions, rate limiting
  Typesense    → search (if needed)
```

Rule: **start with PostgreSQL + Redis. Add others only when PostgreSQL can't handle a specific access pattern.**

---

## Indexes and faster queries

**Why indexes matter** — without the right index, the database scans large ranges; latency grows with table size.

**Common techniques (relational)**

- **B-tree indexes** on columns used in `WHERE`, `JOIN`, `ORDER BY` — match **leftmost prefix** rule for composite indexes `(tenant_id, created_at)`.
- **Partial indexes** — `WHERE status = 'open'` when queries always filter that way (smaller, faster).
- **Covering indexes** — include columns in the index so the engine satisfies the query **index-only** (no table lookup).
- **Unique indexes** — enforce constraints and speed lookups by natural keys.

**Inspect before guessing**

- `EXPLAIN (ANALYZE, BUFFERS)` (Postgres) / execution plans in MySQL — confirm **seq scan** vs **index scan**, row estimates, and cost.

**NoSQL / Dynamo-style**

- Design **partition key + sort key** so each query hits **one partition**; avoid **hot partitions** (shard key with poor cardinality).

**Full-text / search**

- Don’t use `LIKE '%foo%'` at scale — use **PostgreSQL FTS**, **OpenSearch**, or a search product; index the fields you search.

**Anti-patterns**

- Too many indexes → slow writes, bigger storage, planner confusion — drop unused indexes (monitor `pg_stat_user_indexes`).

---

## Sharding (horizontal partitioning)

**When** — single-node DB **cannot** scale writes or storage; **after** exhausting vertical scale, read replicas, caching, and arch changes.

**Idea** — split rows across **shards** by a **shard key** (e.g. `user_id`, `tenant_id`, geographic region). Each shard is a separate DB instance or schema.

**Challenges**

- **Cross-shard queries/joins** — expensive or impossible; design **per-shard** access patterns or aggregate in app / data warehouse.
- **Rebalancing** — moving data when shards get hot; use **consistent hashing** or managed solutions where possible.
- **Transactions** — no easy cross-shard ACID; use **Saga**, outbox, or accept eventual consistency.

**Practical path**

- Start: **single DB + partitioning** (Postgres declarative partitioning) before N independent clusters.
- Managed: **Citus** (Postgres), **Vitess** (MySQL), cloud-native sharded offerings — often simpler than hand-rolled.

---

## Free Local Dev Stack (Docker Compose)

Run everything locally for free:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db

  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: masterKey

volumes:
  pgdata:
  mongodata:
```

```bash
docker compose up -d   # start all
docker compose down    # stop all
docker compose logs -f # tail logs
```

---

## Migration & Schema Tools

```
PostgreSQL:
  Prisma Migrate    → schema-first, auto-generates SQL, great DX
  Drizzle Kit       → code-first, type-safe, lightweight
  Flyway            → SQL-first, enterprise-grade, language-agnostic
  Liquibase         → XML/SQL changesets, audit trail

MongoDB:
  Mongoose schemas  → validation at app layer (no DB-level migrations)
  migrate-mongo     → versioned migration scripts

General rule:
  → Never modify production DB schema manually
  → Every schema change = a migration file in version control
  → Run migrations in CI before deploying new code
  → Always have a rollback migration
```

---

## When to Skip — Opinionated Anti-Patterns

### Skip MongoDB when:
- Data is naturally relational → joins are painful, transactions are complex
- Team knows SQL → zero benefit, real learning curve cost
- You need strong consistency everywhere → Mongo's eventual consistency model requires careful configuration

### Skip DynamoDB when:
- You're pre-product or early stage → access pattern lock-in before you know your query patterns is risky
- Queries are ad-hoc or exploratory → DynamoDB punishes unknown access patterns severely
- Not on AWS → no reason to use it over PostgreSQL

### Skip Redis as primary DB when:
- Data must survive restart → enable persistence (AOF) OR use a real DB
- Storage > 10GB → in-memory cost becomes expensive fast

### Skip Elasticsearch when:
- DAU < 50k → PostgreSQL full-text search handles this well
- Team has no ES experience → mapping explosions, index management, query DSL complexity
- Budget is tight → self-hosted ES needs 4GB+ RAM minimum; managed starts at $50+/mo

### Skip Neo4j when:
- Relationships aren't the primary query → regular joins in PostgreSQL are sufficient
- Team unfamiliar with Cypher → learning curve without clear payoff

### Skip polyglot DB too early when:
- DAU < 100k → operational complexity of 3+ DBs outweighs performance gains
- Solo / small team → each DB is another thing to monitor, back up, and upgrade
- Rule: PostgreSQL + Redis handles 90% of apps up to 500k DAU