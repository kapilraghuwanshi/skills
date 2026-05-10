# Security reference — system-wide (for idea-to-architecture)

Use this file for **defence in depth** across client, API, data, AI, infra, and operations. Security is not only “Layer 6” — it constrains every layer; this doc is the **single place** to think about attackers, trust boundaries, and controls.

---

## Threat model (keep it practical)

Before picking controls, state **who** might attack and **what** they want:

| Concern | Examples |
|---------|----------|
| **External abuse** | Credential stuffing, scraping, DDoS, fraud |
| **Broken auth / session** | Token theft, session fixation, privilege escalation |
| **Data theft** | SQL injection, IDOR, leaky APIs, misconfigured buckets |
| **Supply chain** | Compromised dependency, leaked CI secret |
| **Insider / support** | Over-broad admin access, unlogged changes |
| **AI-specific** | Prompt injection, tool misuse, training-data leakage via RAG |

**Trust boundaries** to draw in architecture: browser ↔ edge ↔ API ↔ services ↔ DB ↔ third parties (payments, LLM, webhooks).

---

## Identity & access (users & services)

- **User auth:** OAuth 2.0 + **OIDC** for social/enterprise login; **short-lived access tokens** + **refresh** via httpOnly cookie where possible; rotate refresh, detect reuse.
- **Service-to-service:** **mTLS** or signed workload identity (IAM roles, SPIFFE); never long-lived shared passwords in env files.
- **Authorization:** **RBAC** or **ABAC** at API boundary; default **deny**; check **every** endpoint (including GraphQL resolvers and BFF routes).
- **IDOR / broken object level auth:** scope every read/write by **tenant + user**; use opaque IDs; never trust client-supplied ownership without server check.
- **Admin / break-glass:** separate role, MFA enforced, full **audit log**, time-bound elevation where possible.

---

## Transport, edge, and availability

- **TLS 1.2+** everywhere; **HSTS** on public web; redirect HTTP → HTTPS.
- **WAF** (managed rules + custom rules) in front of public APIs; geo/blocklists only if policy requires.
- **DDoS:** cloud shield + CDN + rate limits; **origin protection** (only accept traffic from CDN/LB).
- **CORS:** explicit allowed origins; don’t use `*` with credentials.

---

## Application & API security

- **Input validation:** schema at boundary (JSON schema, Zod, OpenAPI); reject unknown fields; size limits on body and uploads.
- **Injection:** parameterized queries / ORM; never concatenate SQL; sanitise where dynamic query building is unavoidable.
- **SSRF:** block internal IPs from user-controlled URLs; allowlists for outbound webhooks and “fetch URL” features.
- **Mass assignment:** don’t bind request bodies directly to DB entities without an allowlist.
- **Rate limiting & abuse:** per-IP, per-user, per-API-key; **429** + backoff; stricter on auth and expensive endpoints (AI, search).
- **CSRF:** SameSite cookies + tokens for cookie-based sessions on state-changing requests.
- **Security headers:** **CSP**, **X-Frame-Options** / frame-ancestors, **Referrer-Policy**, minimal **X-Powered-By** leakage.

---

## Frontend & client (summary — detail in `frontend.md`)

- **XSS** → CSP, encode output, careful with `dangerouslySetInnerHTML` / rich text.
- **Token storage** → prefer httpOnly cookies for session; if localStorage must hold tokens, accept higher XSS risk and tighten CSP + short TTL.
- **Third-party scripts** → inventory, SRI where possible, minimal third parties.

---

## Data protection

- **At rest:** encrypt DB, disks, object storage (KMS-managed keys); encrypt backups.
- **In transit:** TLS between all tiers; private connectivity to managed DB where offered.
- **Secrets:** **Vault / Secrets Manager / cloud secret store**; inject at runtime; **rotation**; never in git.
- **PII:** classify data; minimise collection; **retention** and deletion policy; access logging for sensitive reads.
- **Multi-tenant isolation:** row-level security or strict `tenant_id` in every query; tests that prove cross-tenant access fails.

---

## AI & agents (detail also in `ai-layer.md`)

- **Prompt injection:** treat user content as **untrusted**; system prompts are not a security boundary; separate **tool** permissions from chat “role.”
- **Tool / MCP use:** least-privilege tools; human approval for irreversible or high-risk actions; log tool calls with redaction.
- **RAG:** don’t retrieve across tenant boundaries; sanitise retrieved text before it influences tools or downstream systems.
- **Model abuse:** quotas, billing alerts, output filtering where policy requires (support, regulated content).

---

## Infrastructure & operations

- **Network:** private subnets for data tier; **security groups** / NACLs default deny; no public DB ports.
- **IAM:** least privilege per workload; no static cloud keys on VMs — use instance roles.
- **Patching & images:** minimal base images, regular rebuilds, CVE scanning in CI.
- **CI/CD:** OIDC to cloud (no long-lived AWS keys in GitHub); protected branches; signed artifacts optional but valuable at scale.
- **Dependencies:** SCA (Dependabot, Snyk); lockfiles; review high-severity upgrades.
- **Logging & audit:** auth events, admin actions, data export — **immutable** or forwarded to SIEM; don’t log secrets or full PAN.

---

## Detection & response

- Alerts on: auth anomaly spikes, 5xx from auth service, WAF blocks, sudden egress, secret-scan hits in repo.
- Runbook for: credential leak, ransomware-style object encryption, customer data exposure.
- **Backup & restore** tested — security incident recovery, not only DR.

---

## Compliance & assurance (high level)

Map controls to what you actually need: **GDPR** (lawful basis, DPA, breach notification), **PCI** if you touch cards (prefer processor tokenization), **SOC2** if enterprise sales. Architecture should make “who accessed what” **answerable**.

---

## When to skip (opinionated)

- **Skip “build your own crypto”** — use libraries and cloud KMS.
- **Skip security theatre** — complex CAPTCHAs on every page without abuse signal; focus on rate limits + MFA on risk.
- **Skip per-service JWT shared secrets** at scale — prefer central OIDC + workload identity for services.

---

## How to use this in the skill output

When writing **Layer 6**, **do not** repeat every bullet — **synthesise**: name the **top 5–8 risks** for *this* product, map each to a **concrete control** (what you deploy/configure), and call out **one** deliberate tradeoff (e.g. stricter CSP vs third-party widgets).
