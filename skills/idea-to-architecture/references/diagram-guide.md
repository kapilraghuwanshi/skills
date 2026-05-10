# Diagram Guide — Excalidraw Architecture Output

## Multiple diagram types (when one box-and-arrow isn’t enough)

For complex systems, **split concerns** into separate diagrams. Label each clearly.

| Diagram type | What it shows | Typical audience |
|--------------|---------------|------------------|
| **User flow / journey** | Steps the user takes (screens, decisions, branches), happy path + key errors | PM, design, onboarding |
| **N-tier / C4-style system context** | Clients → edge → apps → data → async → observability (this doc’s default) | Engineering, interviews |
| **Sequence diagram** | Request order, sync calls, retries, timeouts between specific components | Debugging integrations |
| **Deployment / network** | Regions, VPCs, subnets, LB, K8s clusters | Infra, security review |
| **Data / ERD** | **Entities, relationships, cardinalities** (1:1, 1:N, N:M), primary/foreign keys, important indexes | Backend, DBAs, migrations |
| **Event / async flow** | Topics, partitions, producers, consumers, dead-letter | Streaming, reliability |

**Recommendation:** deliver at least **(1) user flow** for the core scenario, **(2) one N-tier architecture** diagram, and **(3) ERD** when more than a handful of tables or non-trivial relationships.

---

## Layout Rules

Draw architecture top-to-bottom, left-to-right:

```
Row 1 (top):     Client layer      — Browser, Mobile App
Row 2:           Edge layer        — CDN, WAF, Global LB
Row 3:           Entry layer       — API Gateway, Auth, Rate Limiter
Row 4:           App layer         — Frontend Server, Backend Services, BFF
Row 5:           Intelligence layer — AI Layer, Agent Layer (if present)
Row 6:           Async layer       — Kafka, SQS, Message Queues
Row 7:           Data layer        — PostgreSQL, Redis, Object Storage, Vector DB
Row 8 (bottom):  Infra layer       — K8s, Monitoring, CI/CD
```

## Element Style Guide

Components:
- Rectangles with rounded corners for services
- Use consistent sizing: major services 160x60, minor 120x40
- Color coding:
  - 🔵 Blue (#4A90E2):   Frontend / Client
  - 🟢 Green (#5CB85C):  Backend Services
  - 🟣 Purple (#9B59B6): AI / Agent Layer
  - 🟠 Orange (#E67E22): Async / Queue Layer
  - 🔴 Red (#E74C3C):    Data Layer (DB, Cache)
  - ⚫ Gray (#95A5A6):   Infra / Observability

Connections:
- Solid arrows: synchronous calls (REST, gRPC)
- Dashed arrows: async / event-driven (Kafka, SQS)
- Double arrows (↔): bidirectional (WebSocket)

Labels on arrows:
- Always label what flows: "REST/HTTPS", "Kafka event", "WebSocket", "gRPC"

## Grouping

Use large background rectangles to group related services:
- "Client Zone" — all client-side components
- "Edge Zone" — CDN, WAF, LB
- "Application Zone" — backend services
- "Data Zone" — all storage
- "Infra Zone" — K8s, monitoring

## Minimum Required Elements

Every diagram must include:
□ At least one client (browser / mobile)
□ Load balancer or API gateway
□ Core backend service(s)
□ Primary database
□ Cache layer (if read-heavy)
□ Message queue (if async / write-heavy)
□ AI layer (if applicable)
□ Observability (can be a small box in corner)

## Example Minimal Architecture

```
[Browser] ──HTTPS──> [CloudFront CDN]
                           │
                     [ALB / API GW]
                           │
              ┌────────────┼────────────┐
              │            │            │
         [Auth Svc]  [API Service]  [AI Svc]
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │                         │
         [PostgreSQL]             [Redis Cache]
                           │
                      [Kafka]
                           │
                  [Worker Services]
                           │
              ┌────────────┼────────────┐
         [S3 Storage]  [Prometheus]  [Kibana]
```