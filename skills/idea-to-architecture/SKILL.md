---
name: idea-to-architecture
description: >
  Generate a complete system architecture from a one-line idea. Covers all layers:
  Frontend, Backend, AI, Agents, Infra, and Security — with every decision justified
  by functional and non-functional requirements.

  Use this skill whenever the user describes an app, product, or system they want to build
  and wants to understand how to architect it. Trigger on phrases like "architect this",
  "system design for", "how would I build", "design a system that", "I want to build X",
  "draw the architecture", "what's the tech stack for", or any time someone describes
  an idea and wants a technical breakdown — even if they don't say "architecture" explicitly.

  Also use for interview prep: "help me design X for a system design interview."
---

# Idea to Architecture

Turns a one-line idea into a complete, justified system architecture across 6 layers.
Every decision traces back to a functional or non-functional requirement.

---

## Phase 1 — Extract Functional Requirements

Before asking anything, read the user's idea and extract:

### FR Extraction Template
```
Use Cases:          What are the 3-5 core things this system does?
User Actions:       What does a user actually do? (search, upload, stream, checkout...)
Business Capabilities: What must the system deliver? (real-time delivery, recommendations...)
Data Entities:      What are the main objects? (User, Post, Order, Video...)
Read vs Write:      Is the dominant pattern reads, writes, or real-time events?
```

Do this silently. Don't show the template — show the extracted output as a clean summary.

---

## Phase 2 — NFR Profile (Ask 3 Questions)

After extracting FRs, ask the user exactly these 3 questions in one message:

```
Before I design the architecture, 3 quick questions:

1. Scale — rough DAU range?
   a) < 10k (early / MVP)
   b) 10k–1M (growth stage)
   c) 1M+ (production scale)

2. Data pattern — what does this system do more of?
   a) Read-heavy (feeds, search, content delivery)
   b) Write-heavy (transactions, uploads, events)
   c) Real-time (chat, live updates, collaborative)
   d) Mixed

3. Consistency — does wrong data cost money, or just feel stale?
   a) Strong consistency (payments, inventory, bookings)
   b) Eventual consistency (social feeds, likes, recommendations)
```

Wait for answers. Then build the NFR profile:

### NFR Profile Builder

Based on answers, infer and state the full NFR profile before generating architecture:

| NFR | Inferred Value | Source |
|-----|---------------|--------|
| Scale | DAU + RPS estimate | Q1 answer |
| Surface | Web / Mobile / Both | Extracted from idea |
| Latency target | p95 / p99 targets | Scale + data pattern |
| Consistency model | Strong / Eventual | Q3 answer |
| Availability target | 99% / 99.9% / 99.99% | Scale |
| Resilience patterns | Queue / Circuit breaker / Fanout | Data pattern |
| Caching strategy | None / Redis / CDN / Both | Read vs write |
| DB choice | SQL / NoSQL / Hybrid | Q3 + data pattern |
| Async needs | Sync / Kafka / WebSocket | Data pattern + latency |
| Offline support | Not needed / Offline-first | Mobile surface |
| Multi-region | No / Active-Passive / Active-Active | Scale + availability |
| Security level | Basic / OAuth+JWT / mTLS+SSO | Scale + data sensitivity |
| Deployment strategy | Manual / CI/CD canary / Blue-green | Scale + team |
| Observability | Logs / Metrics / Full OpenTelemetry | Scale |

Show this table to the user. Say: "Here's the NFR profile I'm working from — let me know if anything looks off."

---

## Phase 3 — Generate Architecture (6 Layers)

Read the relevant reference files before generating each layer:
- Frontend decisions → read `references/frontend.md`
- Mobile app involved → read `references/mobile.md`
- Backend decisions → read `references/backend.md`
- Database selection → read `references/database.md` (CAP theorem, DB choice, free tiers, scaffolding)
- AI layer decisions → read `references/ai-layer.md`
- Agent decisions → read `references/agent-layer.md`
- Infra decisions → read `references/infra.md`
- Security (cross-cutting) → read `references/security.md` early; apply to every layer, then summarise in Layer 6

## Recommendation Philosophy — Be Opinionated

This skill makes concrete recommendations. It does not list options and leave the decision to the user.

Rules:
- **Pick one.** "Use PostgreSQL" not "PostgreSQL or MongoDB depending on your needs."
- **Reject the alternative explicitly.** Say why the other option is wrong for this specific case.
- **Cite the NFR.** Every recommendation traces to scale / consistency / latency / cost.
- **Say skip when appropriate.** If a technology adds complexity without benefit at this scale, say so directly.
- **Give the cost of being wrong.** What happens if they ignore this recommendation?

Anti-pattern to avoid:
```
❌ "You could use Kafka or SQS depending on your requirements"
✅ "Use SQS. Skip Kafka — at <10k DAU your write volume doesn't justify
    Kafka's ops overhead ($200+/mo managed + team ramp-up). SQS handles
    this for ~$5/mo. Revisit Kafka if you exceed 10k messages/sec."
```

For each layer output, use this format:

```
### Layer Name

**Recommendation:** [Specific tool / pattern / approach]

**Why this, not the alternative:**
  → [Alternative] would be wrong here because [specific reason tied to NFR]
  → NFR driver: [Scale / Latency / Consistency / Cost / Maintainability]

**Skip:** [Technology to avoid] — [one-line reason why it's overkill or wrong fit]

**Tradeoffs you're accepting:**
  ✅ What this gives you
  ⚠️  What you give up — and when it becomes a problem

**Upgrade when:** What signal tells you to revisit this decision
```

### Layer 1: Frontend

First, determine the surface type:
```
Is this a mobile app (iOS / Android)?
  → YES → Read references/mobile.md → cover mobile architecture
  → Web only → Read references/frontend.md → cover web architecture
  → Both → Cover both, note shared API strategy (BFF pattern)
```

**If web:** Cover:
- Framework choice (React / Next.js / Vue — justify by SEO + team)
- State management (local / Zustand / Redux — justify by complexity)
- Rendering strategy (CSR / SSR / ISR — justify by SEO + latency needs)
- Micro-frontend consideration (justify by team size + maintainability NFR)
- CDN strategy for static assets
- Performance: code splitting, lazy loading, Core Web Vitals targets
- Real-time: WebSocket / SSE / polling (justify by data pattern)

**If mobile:** Cover:
- Framework choice (React Native / Flutter / native — justify by team + requirements)
- Navigation pattern (stack / tab / drawer)
- Offline-first strategy (local DB, sync engine, conflict resolution)
- State management (TanStack Query + Zustand / Riverpod)
- Push notifications architecture
- OTA update strategy (Expo EAS Update if React Native)
- App store deployment pipeline

### Layer 2: Backend + Database

Cover backend architecture first, then go deep on database:

**Backend:**
- Architecture pattern: Monolith vs Microservices (justify by scale + maintainability)
- API design: REST vs GraphQL vs gRPC (justify by client type + latency)
- Async messaging: Kafka / SQS / BullMQ (justify by write-heavy or resilience NFR)
- Resilience: circuit breaker, retry with backoff, timeouts, fallback responses
- Rate limiting and throttling

**Database (read `references/database.md` for full guidance):**
- Apply CAP theorem: is this CP or AP data? (cite specific data entities)
- Pick primary DB with justification — name the alternative and explain why it's wrong here
- Pick cache layer with justification (or explicitly say skip Redis and why)
- Pick search solution if needed (or say PostgreSQL full-text is sufficient)
- State free tier recommendation for current scale
- State scaffold command so user can start immediately
- Polyglot only if justified — default to PostgreSQL + Redis

### Layer 3: AI Layer

Cover:
- Model selection (GPT-4o / Claude / Gemini / open source — justify by budget + latency)
- Integration pattern: direct API / RAG / fine-tuned
- Context window management (chunking, summarisation strategy)
- Prompt strategy (system prompt design, few-shot examples)
- Latency budget for AI calls (where in the p95 budget does AI sit?)
- Fallback if AI is slow or unavailable
- Cost control: caching AI responses, batching, model routing (cheap model first)

Only include this layer if the idea involves AI. If not, state: "No dedicated AI layer needed — skip to Agents or Infra."

### Layer 4: Agent Layer

Cover:
- What agents exist (one per bounded domain — e.g. SearchAgent, NotificationAgent)
- What each agent owns (its tools, its data, its decisions)
- Orchestration pattern: sequential / parallel / hierarchical
- Tool use: what external APIs / MCPs each agent calls
- Inter-agent communication: message queue / direct call / shared state
- Fault tolerance: what happens when an agent fails
- Human-in-the-loop: when does a human need to approve

Only include if the idea involves autonomous behaviour. If not, state: "No agent layer needed for this architecture."

### Layer 5: Infra

Cover:
- Cloud provider + justification
- Compute: serverless (Lambda) vs containers (K8s) vs VMs
  - < 10k DAU → serverless fine
  - 10k–1M → containers + horizontal scaling
  - 1M+ → K8s + HPA + cluster autoscaling
- Load balancing: ALB / GLB / regional
- CDN: CloudFront / Cloudflare (for read-heavy, static, or global)
- Availability: single-region vs multi-region
  - Active-Passive vs Active-Active (justify by availability NFR + cost)
- No SPOF analysis: identify and eliminate single points of failure
- Message queue infra: Kafka cluster / SQS setup
- CI/CD pipeline:
  - Canary deployment (gradual rollout, catch errors early)
  - Blue-Green (instant rollback capability)
  - Feature flags (decouple deploy from release)
  - "Ship small, rollback fast" principle
- Observability stack:
  - Logging → ELK (Elasticsearch + Logstash + Kibana)
  - Metrics → Prometheus + Grafana
  - Tracing → OpenTelemetry (E2E distributed tracing)
  - 3 Golden Signals: latency, error rate, throughput
- Testing strategy: unit → integration → E2E → smoke → chaos

### Layer 6: Security

Read `references/security.md` for threat model, identity, edge, API, data, AI/agent, infra, and detection. **Synthesise** for this product — do not paste the whole checklist.

Cover across all layers (tailor to NFR and surface):
- **Identity:** OAuth 2.0 + OIDC / JWT or session strategy; mTLS or workload identity service-to-service; SSO if enterprise
- **Edge & transport:** TLS, WAF, DDoS posture, CORS
- **Application / API:** validation, injection/SSRF controls, rate limits, CSRF if cookie session, authz (incl. IDOR)
- **Data:** encryption at rest + in transit, KMS, secrets store, tenant isolation for multi-tenant
- **AI/agents (if any):** prompt injection, tool/MCP least privilege, RAG tenancy
- **Network:** VPC, private data tier, security groups
- **Ops:** dependency/supply chain, CI secrets, audit logging for sensitive actions

Output the **top risks for this idea** and the **specific controls** you recommend (opinionated, tied to NFR).

---

## Phase 4 — Decision Log

After all layers, output a clean decision log:

```
## Decision Log

| Decision | Chosen | Because | NFR |
|----------|--------|---------|-----|
| Database | PostgreSQL | Payment data needs ACID transactions | Consistency: Strong |
| Messaging | Kafka | Write-heavy, needs durability + replay | Write-heavy + Resilience |
| Caching | Redis | Read-heavy feed, p95 <200ms target | Latency + Read-heavy |
| Deployment | Blue-Green | Zero downtime releases needed at scale | Availability 99.9% |
| Tracing | OpenTelemetry | Multi-service, need E2E visibility | Observability |
```

---

## Phase 5 — Excalidraw Diagram

After the decision log, draw the architecture using Excalidraw.

Read `references/diagram-guide.md` for element format, layout rules, and **when to add extra diagrams** (e.g. **user flow**, **N-tier/system context**, **ERD / table relationships**). Prefer at least one system diagram; add user flow + ERD when they clarify the design.

Layout order (left to right, top to bottom):
```
[Client / Browser / Mobile]
        ↓
[CDN] → [Load Balancer / API Gateway]
        ↓
[Frontend Server / BFF]
        ↓
[Backend Services]    [AI Layer]    [Agent Layer]
        ↓                  ↓              ↓
[Message Queue (Kafka)]
        ↓
[Databases]    [Cache (Redis)]    [Object Storage]
        ↓
[Infra: K8s / Serverless]
        ↓
[Observability: Prometheus + Grafana + Kibana + OpenTelemetry]
```

---

## Phase 6 — Cost Ballpark

```
## Cost Ballpark (monthly, USD)

| Tier | DAU | Approx Cost | Main drivers |
|------|-----|-------------|--------------|
| 🟢 Small | <10k | $50–$300 | Serverless + managed DB |
| 🟡 Medium | 10k–1M | $500–$5,000 | K8s cluster + Redis + Kafka |
| 🔴 Large | 1M+ | $10,000+ | Multi-region + dedicated infra |
```

Note: "These are order-of-magnitude estimates. Actual cost depends heavily on data transfer, storage, and AI API usage."

---

## Output Checklist

Before finishing, verify:
- [ ] FRs extracted and shown
- [ ] NFR profile table shown and confirmed
- [ ] All 6 layers covered (or explicitly skipped with reason)
- [ ] Every major decision has a "why" citing an NFR
- [ ] Decision log complete
- [ ] Excalidraw diagram(s) drawn (system + user flow / ERD if useful)
- [ ] Cost ballpark included
- [ ] Offer: "Want me to go deeper on any layer?"