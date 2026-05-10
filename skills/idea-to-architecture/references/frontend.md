# Frontend Architecture Reference

## Framework Decision Tree

```
Is this mobile-first or native?
  → Yes → React Native / Flutter
  → No ↓

Does SEO matter? (public content, marketing, e-commerce)
  → Yes → Next.js (SSR / ISR)
  → No ↓

Is it a complex dashboard / internal tool?
  → Yes → React + Vite (CSR, no SSR needed)
  → No → Next.js (safe default, flexible)
```

## Rendering Strategy

| Strategy | When to use | NFR |
|----------|-------------|-----|
| SSR (Server Side Rendering) | SEO critical, first-load performance matters | Latency p95, Public content |
| ISR (Incremental Static Regen) | Content changes infrequently (blogs, product pages) | Read-heavy, CDN-friendly |
| CSR (Client Side Rendering) | Auth-gated apps, dashboards, internal tools | Simplicity, no SEO need |
| Streaming SSR | Large pages, AI-generated content, progressive load | Latency, real-time feel |

## State Management

```
Local UI state only (forms, modals)?
  → useState / useReducer — no library needed

Shared state across a few components?
  → Zustand (simple, minimal boilerplate)

Complex state with many actors / optimistic updates?
  → Redux Toolkit + RTK Query

Server state (API data, caching, background sync)?
  → React Query / TanStack Query (always pair with above)

Real-time shared state (collaborative editing)?
  → Yjs + WebSocket / Liveblocks
```

## Real-time Strategy

| Pattern | Latency | Use case | NFR driver |
|---------|---------|----------|------------|
| WebSocket | ~50ms | Chat, live collaboration, auction | Real-time NFR |
| SSE (Server-Sent Events) | ~100ms | Live feeds, notifications, AI streaming | Read-heavy real-time |
| Long polling | ~500ms | Simple notifications, low frequency | Simplicity |
| Polling | >1s | Dashboard refresh, non-critical updates | Maintainability |

## Micro-Frontend

Use when:
- Multiple teams own different parts of the UI (Maintainability NFR)
- Different release cadences per section
- Scale > 50 engineers

Patterns:
- **Module Federation** (Webpack 5) — runtime composition, shared deps
- **iFrame isolation** — hard boundary, legacy integration
- **Web Components** — framework-agnostic, slower adoption

Avoid micro-frontend if: solo or small team (< 5 engineers). Overhead outweighs benefit.

## Performance Checklist

- Code splitting: route-based lazy loading (React.lazy + Suspense)
- Image optimisation: Next.js Image / WebP / lazy load below fold
- Bundle analysis: Webpack Bundle Analyzer — catch bloat early
- Core Web Vitals targets:
  - LCP < 2.5s (largest content paint)
  - INP < 200ms (interaction to next paint — core interactivity metric)
  - CLS < 0.1 (layout shift)
- CDN for all static assets (JS, CSS, images, fonts)
- Prefetch critical routes on hover

---

## Observability, RUM, and frontend SLOs

**Real User Monitoring (RUM)** — measure what real users experience (not synthetic only). Examples: **Splunk RUM**, **Datadog RUM**, **Elastic RUM**. Correlate front-end traces with backend traces (trace IDs on API calls).

**Error and performance SDKs**

- **Sentry Browser SDK** (or similar): Performance API (navigation, resources, long tasks), **error tracking** with grouping (fingerprinting), release tracking, breadcrumbs.
- **OpenTelemetry browser / “fe-telemetry”**: export web vitals and traces to your OTLP backend; pair with **Grafana** (dashboards: LCP trend, error rate, API latency by route).

**What Sentry-style tooling typically gives you**

| Capability | Why it matters |
|------------|----------------|
| Performance API + Web Vitals | Tie slow pages to deploys, regions, devices |
| Error grouping | Noise reduction — one issue for thousands of events |
| Alerts | Uptime checks, error-rate spikes, latency SLO burn |
| Time bucketing | See errors/latency by hour — incident correlation |

**Example frontend SLOs (tune to product)**

| Objective | Target | Signal |
|-----------|--------|--------|
| **Availability** | e.g. **99.9%** successful page loads | RUM: load success / synthetic |
| **Stability** | e.g. **JS crash rate &lt; 0.1%** of sessions | Unhandled errors / sessions |
| **API reliability** | e.g. **99.5%** client-observed API success | Wrapped `fetch`/axios + HTTP 2xx/expected errors |
| **LCP** | **&lt; 2500 ms** (good) | Web Vitals / RUM |
| **INP** | **&lt; 200 ms** (good) | Replaces FID as core interactivity metric |
| **CLS** | **&lt; 0.1** | Layout stability / UX |

Instrument **API calls** in one place (wrapper): which route failed, status, latency, correlation id — so support matches “checkout broke” to `/api/orders` 500s.

---

## React: ErrorBoundary vs global handlers

- **`<ErrorBoundary>` (React 18+ class or `react-error-boundary`)** — catches **render** errors and errors in child lifecycle in that subtree. Use per route or around risky widgets so **one failed widget does not white-screen the whole app**. Log to Sentry with component stack.
- **What it does *not* catch:** async errors inside `useEffect`, event handlers, or rejected promises unless you rethrow into React — handle those separately.
- **`window.onerror`** — catch non-React global JS errors (legacy scripts, some sync failures).
- **`window.onunhandledrejection`** — catch **unhandled Promise rejections** (common with forgotten `.catch()` on `fetch`).

**React DevTools — “unnecessary re-render”** — use **Profiler** or highlight updates to find components re-rendering on every parent tick; fix with `memo`, stable callbacks, colocated state, or splitting context.

---

## Rendering tradeoffs: CSR | SSR | SSG | ISR | Edge

| Mode | Where HTML is built | Best for | Tradeoff |
|------|---------------------|----------|----------|
| **CSR** | Browser | Dashboards, heavy interactivity, no SEO | Slow first meaningful paint; SEO weak |
| **SSR** | Server per request | Personalized, fresh data, SEO | Higher TTFB under load; server cost |
| **SSG** | Build time | Marketing, docs, stable pages | Rebuild to change content |
| **ISR** | SSG + periodic/on-demand regen | Catalog, blog at scale | Stale window by design; cache invalidation discipline |
| **Edge** | CDN edge (Vercel/Cloudflare Workers) | Geo-low latency auth, A/B, light personalization | Limited runtime/DB proximity; not for heavy CPU |

Pick **one primary** per route; mix within the same app (e.g. marketing SSG + app CSR).

---

## Web Workers

- **Use for:** heavy parsing, image/audio work, large CSV transform — **off the main thread** so INP/LCP stay healthy.
- **Avoid for:** trivial work (serialization cost) or when you need direct DOM access (workers cannot touch DOM).

---

## Browser storage

| API | Sync? | Notes |
|-----|-------|--------|
| **localStorage / sessionStorage** | Sync — **can block** main thread on large values | Small flags, tokens only if threat model allows (prefer httpOnly cookies for session) |
| **IndexedDB** | Async | Larger structured data, offline queues; NoSQL-like in browser |
| **Cache API** | Async | Pairs with **Service Worker** for offline/shell caching |

---

## PWA

- **Service worker** as **network proxy**: cache strategies — **network-first** (fresh when online), **cache-first** (offline shell), **stale-while-revalidate** (fast paint + background refresh).
- **Offline:** background sync (where supported), queued writes, clear **fallback UI** (“you’re offline”).
- **Installability:** manifest + icons; not every product needs “Add to Home Screen.”

---

## Optimistic updates

- Update UI immediately; **rollback** on API failure (TanStack Query `onError` revert, or local undo).
- Pair with **idempotent** server APIs where possible so retries are safe.

---

## Accessibility (a11y)

- **Automate:** **Axe** (CI + browser), **Lighthouse** accessibility category.
- **Manual checks:** semantic HTML, heading order, **contrast**, visible **focus**, keyboard — **Tab** order, **Esc** closes dialogs, **Space** activates buttons.

---

## SEO (frontend-facing)

- Meaningful titles/meta, crawlable links (not JS-only navigation for critical paths), structured data where relevant, fast LCP (SSR/SSG/ISR for content pages), avoid cloaking.

---

## Frontend testing strategy

| Layer | Tools (examples) | Focus |
|-------|------------------|--------|
| **Unit** | Jest, Vitest | Pure functions, hooks logic, reducers |
| **Component / UI** | React Testing Library | User-visible behaviour, not implementation detail |
| **Integration** | RTL + MSW | Multiple components + mocked API |
| **E2E** | Playwright, Cypress | Critical paths, real browser, auth flows |

Prefer **fewer, high-value E2E** tests; cover breadth with unit + integration.

---

## Security (Frontend)

- **HTTPS / TLS** — all traffic encrypted; HSTS to reduce downgrade risk.
- **httpOnly cookies** — session tokens not readable from JS → reduces impact of XSS stealing `document.cookie` (still combine with **CSP** + **input sanitization**).
- **CORS** — `Access-Control-Allow-Origin` is **not** auth; use explicit allowed origins; credentials only with care.
- **CSP** — restrict `script-src`, `style-src`, `connect-src`, etc.; reduces XSS blast radius (e.g. `self` + nonces for inline).
- **XSS** — attacker-injected script can exfiltrate data or act as user; mitigate with CSP, encode output, sanitize rich text, avoid `dangerouslySetInnerHTML` without sanitizer.
- **CSRF** — malicious site tricks the browser into submitting a request **with** the user’s cookies; mitigate with **SameSite** cookies, CSRF tokens on state-changing requests, and sensitive actions behind re-auth where needed.
- **Dependencies**: Regular `npm audit`, Dependabot alerts

---

## When to Skip — Opinionated Anti-Patterns

### Skip Next.js SSR when:
- App is auth-gated (no public pages, no SEO need) → CSR with Vite is simpler and faster to build
- Team unfamiliar with server components → hydration bugs eat sprint velocity

### Skip Redux when:
- App has < 5 shared state slices → Zustand does the job in 20 lines vs Redux's 200
- No time-travel debugging needed → Redux overhead not justified
- Rule: reach for Redux only when Zustand starts feeling painful

### Skip Micro-Frontend when:
- Team < 10 engineers → Module Federation setup cost never pays off
- Single deployment cadence → no benefit to splitting if everything ships together
- Creates distributed monolith: separate builds but still tightly coupled behavior

### Skip WebSocket when:
- Updates are one-way server → client → use SSE (simpler, works over HTTP/2, auto-reconnect)
- Update frequency < 1/minute → polling is fine and 10x simpler to implement and debug

### Skip React Query when:
- App has no server state (fully local / offline) → adds complexity with no benefit
- Already using Redux RTK Query → don't mix two server-state solutions