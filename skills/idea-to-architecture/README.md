# idea-to-architecture

> A Claude skill that turns a one-line idea into a complete, justified system architecture.

## What it does

Give it any app idea. It extracts functional requirements, builds an NFR profile by asking 3 targeted questions, then generates a full architecture across 6 layers — every decision traced back to a specific requirement.

**Output includes:**
- Functional requirements extracted from your idea
- NFR profile (scale, consistency, latency targets, availability, etc.)
- Architecture across 6 layers: Frontend → Backend → AI → Agents → Infra → Security
- Decision log — why each technology was chosen, citing the NFR that drove it
- Excalidraw diagram — visual architecture drawn automatically
- Cost ballpark at 3 scale tiers

## Example

**Input:**
> "I want to build a real-time AI code review tool"

**Output:**
1. FRs: code submission, AI analysis, real-time feedback, diff view, comment threads
2. NFR profile: based on your 3 answers (scale / data pattern / consistency)
3. Full architecture with justified choices:
   - Next.js SSR + WebSocket for real-time feedback
   - Node.js microservices (at scale) or modular monolith (MVP)
   - PostgreSQL for review data (strong consistency) + Redis for live session state
   - Claude Sonnet for code analysis with RAG over codebase context
   - Kafka for async review job queue (write-heavy, absorbs bursts)
   - EKS + HPA + blue-green deploys at production scale
4. Decision log linking every choice to an NFR
5. Excalidraw architecture diagram

## Install

### Option 1 — Zip from this repo (Claude upload)
From the monorepo root:

```bash
./scripts/package-skill.sh idea-to-architecture
```

Upload `dist/idea-to-architecture.zip` (or the folder `skills/idea-to-architecture/`) via **Claude → Settings → Skills** if your plan supports it. Optionally attach the same zip to a [GitHub Release](https://github.com/kapilraghuwanshi/skills/releases) for a stable download URL.

### Option 2 — Clone and point Claude at this folder
```bash
git clone https://github.com/kapilraghuwanshi/skills.git
```

Install the directory **`skills/idea-to-architecture/`** (must contain `SKILL.md` at that folder’s root) in Claude’s Skills settings.

## Usage

Once installed, just describe what you want to build:

```
"Architect a real-time collaborative whiteboard app"
"How would I build a food delivery platform like Swiggy?"
"Design a system for a video streaming service — system design interview"
"I want to build an AI-powered resume screener"
```

Claude will automatically activate the skill and walk you through the full process.

## What the 3 questions drive

| Question | Drives |
|----------|--------|
| Scale (DAU range) | Compute strategy, DB sharding, CDN, multi-region |
| Data pattern (read/write/real-time) | Kafka vs Redis, caching, async vs sync, WebSocket |
| Consistency (strong vs eventual) | SQL vs NoSQL, replication strategy, ACID requirements |

## NFR Coverage

This skill systematically covers all major non-functional requirements:

- **Scale** — DAUs, RPS estimation, horizontal scaling strategy
- **Latency** — p95/p99 targets, latency budgets per tier, async hot paths
- **Resilience** — queues, circuit breakers, fanout, quorum
- **Reliability** — graceful degradation, retries, timeouts, fallbacks
- **Consistency** — strong vs eventual, replication, SQL vs NoSQL
- **Availability** — uptime targets, multi-region, active-active vs active-passive, no SPOF
- **Maintainability** — microservices, micro-frontends, clean API contracts
- **Observability** — 3 golden signals, OpenTelemetry, Prometheus, Grafana, Kibana
- **Testing** — unit, integration, E2E, smoke, chaos
- **Deployment** — CI/CD, canary, blue-green, feature flags, rollback strategy
- **Security** — OAuth 2.0, JWT, mTLS, SSO, encryption at rest + transit, XSS, CSRF

## Skill Structure

```
idea-to-architecture/
├── README.md                 ← this file (human overview / UI preview)
├── SKILL.md                  ← agent workflow
└── references/
    ├── frontend.md
    ├── mobile.md
    ├── backend.md
    ├── database.md
    ├── ai-layer.md
    ├── agent-layer.md
    ├── infra.md
    ├── security.md       ← cross-cutting: threat model, IAM, data, AI, edge, ops
    └── diagram-guide.md
```

## Contributing

PRs welcome. Especially for:
- Additional reference files (e.g. `data-pipeline.md`)
- Better cost estimates
- More diagram examples
- Edge case handling (IoT, gaming, fintech-specific patterns)

## License

MIT