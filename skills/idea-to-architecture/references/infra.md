# Infra Reference

## Cloud Provider Selection

```
Default → AWS (widest service breadth, largest ecosystem)
Google-heavy stack / ML-first → GCP (best managed ML infra, BigQuery)
Microsoft / enterprise / .NET → Azure (Active Directory, enterprise compliance)
Multi-cloud / cost optimisation → Cloudflare Workers + R2 + DO (edge-first, cheap egress)
```

## Compute Strategy by Scale

```
< 10k DAU (MVP / early):
  → Serverless (AWS Lambda / Vercel / Cloud Run)
  → Zero infra management, pay per request
  → Watch: cold starts for AI/heavy workloads (use min instances)
  → DB: managed (RDS / PlanetScale / Supabase)

10k–1M DAU (growth):
  → Containers on managed K8s (EKS / GKE)
  → Horizontal Pod Autoscaler (HPA) on CPU + custom metrics
  → Mix: serverless for async jobs, containers for API
  → DB: dedicated RDS + read replicas + Redis cluster

1M+ DAU (production scale):
  → K8s with Cluster Autoscaler + Karpenter (node-level scaling)
  → Dedicated node pools per workload type (API / ML / batch)
  → Multi-region active-active
  → DB: sharded + globally replicated
  → Kafka cluster: 3+ brokers, replication factor 3
```

## Load Balancing

```
Global (multi-region):
  → AWS Global Accelerator / Cloudflare / GCP GLB
  → Anycast routing → routes to nearest healthy region
  → GeoDNS fallback

Regional (within region):
  → Application Load Balancer (ALB) — HTTP/HTTPS, path-based routing
  → Network Load Balancer (NLB) — TCP, ultra-low latency, WebSocket

Service-to-service (internal):
  → K8s Service (ClusterIP)
  → Service mesh (Istio / Linkerd) for mTLS + traffic management
```

## CDN Strategy

```
Use CDN for:
  → Static assets (JS, CSS, images, fonts) — always
  → Public API responses (GET, cacheable) — TTL 1min–1hr
  → Video / large file delivery — required at scale

CDN options:
  → CloudFront (AWS-native, tight S3 integration)
  → Cloudflare (best performance globally, DDoS protection built-in)
  → Fastly (edge compute, real-time purge)

Cache-Control headers:
  → Static assets: Cache-Control: max-age=31536000, immutable (1 year, content-hashed)
  → HTML: Cache-Control: no-cache (revalidate on every request)
  → API: Cache-Control: s-maxage=60 (CDN caches 60s, client doesn't cache)
```

## Availability: Single vs Multi-Region

```
99% uptime (~87h downtime/year)   → Single region, multi-AZ
99.9% uptime (~8.7h/year)         → Single region, multi-AZ + fast failover
99.99% uptime (~52min/year)       → Multi-region active-passive
99.999% uptime (~5min/year)       → Multi-region active-active

Active-Passive:
  → Primary region handles all traffic
  → Secondary region is warm standby
  → Failover: DNS switch (TTL matters — keep low: 60s)
  → RTO: minutes, RPO: seconds (depends on replication lag)
  → Simpler, cheaper than active-active

Active-Active:
  → All regions handle traffic simultaneously
  → Data replication: synchronous (consistent, latency cost) or async (eventual)
  → Conflict resolution required for writes
  → No SPOF — if one region dies, others absorb traffic automatically
  → Complex: data sovereignty, consistency across regions, latency-aware routing

No SPOF checklist:
  □ Multiple AZs for every service
  □ DB has replica in different AZ
  □ Load balancer has redundancy
  □ No single Kafka broker
  □ No single Redis node (Redis Sentinel / Redis Cluster)
  □ Secrets not stored in one place
```

## Observability Stack

```
3 Golden Signals (instrument these first):
  1. Latency    — how long requests take (p50, p95, p99)
  2. Error rate — % of requests returning 5xx
  3. Throughput — requests per second

Full stack:

Logging:
  → Structured JSON logs (never plain text at scale)
  → ELK Stack: Elasticsearch + Logstash + Kibana
  → Or: Loki + Grafana (cheaper, Kubernetes-native)
  → Log levels: ERROR (alert), WARN (investigate), INFO (audit), DEBUG (dev only)

Metrics:
  → Prometheus (scrapes metrics from services)
  → Grafana (dashboards, alerting)
  → Expose /metrics endpoint on every service
  → Key metrics: request rate, error rate, latency histograms, saturation

Tracing:
  → OpenTelemetry SDK (language-agnostic, vendor-neutral)
  → Trace every request E2E across services
  → Jaeger / Tempo (open source) or Datadog / Honeycomb (managed)
  → Trace context propagated via HTTP headers (W3C Trace Context)

Alerting:
  → PagerDuty / Opsgenie for on-call routing
  → Alert on: error rate spike, p99 latency breach, queue depth growing, disk > 80%
  → Dead man's switch: alert if metrics STOP arriving (service is down silently)
```

## CI/CD Pipeline

```
Pipeline stages:
  1. Lint + type check   (< 30s)
  2. Unit tests          (< 2min)
  3. Build               (< 5min)
  4. Integration tests   (< 10min)
  5. Deploy to staging   (auto on merge to main)
  6. Smoke tests on staging
  7. Deploy to production (with chosen strategy below)

Deployment strategies:

Canary:
  → Ship to 1% of traffic first
  → Monitor error rate + latency for 10–30min
  → Auto-promote to 100% if healthy / auto-rollback if not
  → Best for: production risk reduction

Blue-Green:
  → Two identical environments (blue = live, green = new version)
  → Deploy to green → run tests → switch traffic instantly
  → Blue stays warm for instant rollback
  → Best for: zero-downtime deployments, easy rollback

Feature Flags:
  → Deploy code dark (to all servers, but off for users)
  → Enable for % of users or specific users
  → Decouple deploy from release
  → Tools: LaunchDarkly, Unleash, Flagsmith (open source)

"Ship small, rollback fast" principle:
  → Small PRs → small deploys → small blast radius
  → Rollback < 5 minutes (never wait for re-deploy, use blue-green or flags)
```

## Testing Strategy

```
Unit tests       → Fast, isolated, every function/component
                   Target: 70%+ coverage on business logic

Integration tests → Test service boundaries (API + DB, service A → service B)
                   Target: all critical paths covered

E2E tests        → Full user flow in real environment (Playwright / Cypress)
                   Target: top 5–10 user journeys

Smoke tests      → Minimal test suite run after every deploy
                   Verifies: can users log in, can they do the core action?

Chaos testing    → Deliberately kill services, inject latency, corrupt data
                   Tools: Chaos Monkey, Gremlin
                   Run in staging before production

Contract tests   → Verify API contracts between services don't break
                   Tools: Pact (consumer-driven contract testing)
```

## Cost Ballpark Reference

```
Small (<10k DAU):
  Serverless compute:    $10–50/mo
  Managed DB (small):    $20–50/mo
  CDN:                   $5–20/mo
  Redis (managed):       $15–30/mo
  Total:                 ~$50–150/mo

Medium (10k–1M DAU):
  K8s cluster (3 nodes): $200–600/mo
  RDS + read replica:    $100–300/mo
  Redis cluster:         $100–200/mo
  Kafka (MSK):           $200–500/mo
  CDN:                   $50–200/mo
  Total:                 ~$700–2,000/mo

Large (1M+ DAU):
  Multi-region K8s:      $2,000–10,000/mo
  DB (sharded/global):   $1,000–5,000/mo
  Kafka (large):         $500–2,000/mo
  CDN (high traffic):    $500–3,000/mo
  Observability stack:   $500–2,000/mo
  Total:                 ~$5,000–25,000+/mo

AI adds:
  GPT-4o at 1M req/mo:  ~$5,000–15,000/mo (varies heavily by token count)
  Claude Sonnet:         ~$3,000–10,000/mo
  Open source (self-hosted GPU): $1,000–3,000/mo infra cost
```

---

## When to Skip — Opinionated Anti-Patterns

### Skip Kubernetes when:
- DAU < 50k → serverless (Lambda / Cloud Run) is cheaper and zero ops
- Team has no K8s experience → ECS or App Runner is 80% of K8s with 20% of the complexity
- Solo founder / freelancer → K8s cluster management will consume your entire ops budget (time + money)

### Skip Multi-Region when:
- Availability target is 99% or 99.9% → multi-AZ single region achieves this at 1/3 the cost
- DAU < 500k → latency gain from geo-routing not worth active-active complexity
- No compliance requirement forcing data residency → keep it simple

### Skip Blue-Green when:
- Serverless deployment → Lambda handles this natively with traffic shifting
- No stateful connections (DB connections, WebSockets) → canary is simpler

### Skip Full ELK Stack when:
- DAU < 50k → CloudWatch Logs (AWS) or Loki is sufficient and cheaper
- ELK self-hosted: $300+/mo in infra + ops burden
- Use managed: Datadog / Grafana Cloud free tier to start

### Skip Canary Deploys when:
- No real user traffic yet → not enough signal to detect canary failures
- Stateful deploys with DB migrations → canary + schema change coordination is complex
- Use feature flags instead for controlled rollout without deployment complexity

### Skip CDN when:
- Internal tool / admin dashboard → no public traffic, CDN adds cost with no benefit
- All content is personalised / dynamic → CDN cache hit rate will be near 0%