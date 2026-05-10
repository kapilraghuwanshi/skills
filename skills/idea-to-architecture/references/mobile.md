# Mobile Architecture Reference

## Should this system have a mobile layer?

```
Does the idea involve a mobile app (iOS / Android)?
  → YES → Use this reference
  → NO  → Skip. Web frontend.md is sufficient.

Is mobile the PRIMARY surface or a companion to web?
  → Primary  → Mobile-first architecture (this file)
  → Companion → Shared API, separate mobile client (lighter version of this file)
```

---

## Framework Decision Tree

```
Does the team know React / JavaScript already?
  → YES → React Native (Expo managed workflow to start)

Does the app need pixel-perfect custom UI or heavy animations?
  → YES → Flutter (Dart, full rendering engine, consistent across platforms)

Is this iOS-only or Android-only with deeply native features?
  → iOS only    → Swift + SwiftUI
  → Android only → Kotlin + Jetpack Compose

Is this a simple content / informational app?
  → React Native + Expo (fastest to market, OTA updates)

Is this a high-performance game or graphics-heavy app?
  → Flutter (Skia/Impeller rendering) or native
```

### Framework Comparison

| | React Native (Expo) | Flutter | Native (Swift/Kotlin) |
|---|---|---|---|
| Language | JavaScript / TypeScript | Dart | Swift / Kotlin |
| Performance | Good (JS bridge → JSI) | Excellent (own renderer) | Best |
| Dev speed | Fast | Fast | Slower |
| Code sharing | ~90% shared | ~95% shared | 0% (separate codebases) |
| OTA updates | ✅ Expo EAS Update | ❌ App store required | ❌ App store required |
| Deep native access | Via modules | Via platform channels | Native |
| Best for | Most apps, existing JS teams | Custom UI, animations, scale | Platform-specific features |

---

## Project Structure (React Native / Expo)

```
app/
├── (tabs)/              ← Expo Router file-based routing
│   ├── index.tsx        ← Home tab
│   ├── explore.tsx
│   └── _layout.tsx
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
└── _layout.tsx          ← Root layout, providers

components/
├── ui/                  ← Base design system components
├── features/            ← Feature-specific components
└── shared/              ← Shared across features

hooks/                   ← Custom hooks
services/                ← API clients, storage
store/                   ← State management
utils/                   ← Pure functions
```

---

## Navigation

```
React Native:
  → Expo Router (file-based, like Next.js) — recommended default
  → React Navigation (imperative, more control)

Navigation patterns:
  → Stack:  push/pop screens (drill-down flows)
  → Tab:    bottom tab bar (main app sections)
  → Drawer: side menu (settings, secondary nav)
  → Modal:  overlay screens (sheets, dialogs)

Deep linking:
  → Always configure from day 1 (push notifications need it)
  → Expo Router handles this automatically
  → Universal links (iOS) + App Links (Android) for web ↔ app handoff
```

---

## State Management (Mobile)

```
Server state (API data)?
  → TanStack Query (React Native) / Riverpod (Flutter)
  → Handles: caching, background refetch, optimistic updates

Local UI state?
  → useState / useReducer (React Native)
  → Riverpod / Provider (Flutter)

Global app state (auth, user, settings)?
  → Zustand (React Native) — lightweight, minimal boilerplate
  → Bloc (Flutter) — structured, testable

Offline state (queue, sync)?
  → WatermelonDB / MMKV + custom sync layer (React Native)
  → Drift / Isar (Flutter)
```

---

## Offline-First Architecture

This is the most critical mobile-specific concern. Design for offline from day 1.

### Core Principle
```
Never assume network is available.
Read from local DB first, sync in background.
User action succeeds immediately — reconcile with server async.
```

### Offline-First Stack

```
React Native:
  Local DB:     WatermelonDB (SQLite, reactive, sync-friendly)
                OR MMKV (key-value, ultra-fast, simple data)
  Sync engine:  Custom sync layer OR PowerSync OR Realm (Atlas)
  Queue:        react-native-queue / custom AsyncStorage queue

Flutter:
  Local DB:     Drift (SQLite ORM) OR Isar (NoSQL, fast)
  Sync engine:  Custom OR Realm
  Queue:        Custom with Isar persistence
```

### Sync Patterns

**Last-Write-Wins (simple)**
```
Client writes locally → queues operation → uploads when online
Server applies operation → resolves conflicts by timestamp
Use when: simple data, low conflict probability
```

**Operational Transforms / CRDTs (complex)**
```
Use when: collaborative editing, shared documents, concurrent edits
CRDTs: data structures that merge automatically without conflicts
Libraries: Yjs (React Native), Automerge
```

**Delta Sync**
```
Client sends last_synced_at timestamp
Server returns only records changed since then
Reduces bandwidth significantly
Use when: large datasets, mobile data cost matters
```

### Offline-First Flow

```
User opens app
      ↓
Load from local DB instantly (no loading spinner)
      ↓
Check network → if online → fetch delta from server
      ↓
Merge server changes into local DB
      ↓
UI updates reactively (no manual refresh)

User performs action (create / update / delete)
      ↓
Write to local DB immediately (optimistic)
      ↓
Queue operation for server sync
      ↓
Background sync when network available
      ↓
On conflict → resolve (last-write-wins / merge / prompt user)
```

### Conflict Resolution

```
No conflict possible (append-only):
  → Just sync, no resolution needed
  → e.g. activity log, chat messages

Last-write-wins:
  → Compare updated_at timestamps
  → Server timestamp wins (simpler) OR client timestamp wins (better UX)

Field-level merge:
  → Merge non-conflicting field changes
  → Flag only true conflicts (same field, different value)

User-resolved:
  → Show conflict to user, let them pick
  → Use sparingly — users hate it
```

---

## Performance

```
List rendering:
  → Always use FlashList (React Native) over FlatList — 10x faster
  → Virtualized, only renders visible items
  → Flutter: ListView.builder (lazy, virtualized by default)

Images:
  → expo-image (React Native) — disk + memory cache, blurhash placeholder
  → cached_network_image (Flutter)
  → Always use WebP format, size to display dimensions

Animations:
  → React Native Reanimated (runs on UI thread, no JS bridge)
  → Flutter animations run natively — smooth by default
  → Avoid JS-thread animations (cause jank)

Bundle size:
  → Tree-shake aggressively
  → Lazy load heavy screens
  → Monitor with @expo/bundle-analyzer

JS thread rules (React Native):
  → Keep JS thread free — offload heavy computation to:
     - Worklets (Reanimated)
     - Native modules
     - Web Workers (via react-native-threads)
```

---

## Push Notifications

```
Service:
  → Expo Notifications (simplest, managed)
  → Firebase Cloud Messaging / FCM (most flexible, cross-platform)
  → APNs (iOS direct) — FCM wraps this

Flow:
  1. App requests permission (prompt at right moment — not on first open)
  2. Get device push token
  3. Store token on server (linked to user_id)
  4. Server sends notification via FCM / Expo Push API
  5. Handle foreground / background / killed app states

Deep link from notification:
  → Notification payload includes route
  → App opens to correct screen on tap
  → Always test all 3 states: foreground, background, killed
```

---

## Auth on Mobile

```
Strategies:
  → JWT (access + refresh tokens)
     - Store access token: memory (most secure)
     - Store refresh token: expo-secure-store / Keychain (iOS) / Keystore (Android)
     - NEVER store in AsyncStorage (not encrypted)

  → OAuth / Social login:
     - expo-auth-session (React Native)
     - google_sign_in / sign_in_with_apple (Flutter)
     - Use PKCE flow (no client secret on device)

  → Biometric auth:
     - expo-local-authentication (FaceID / TouchID / Fingerprint)
     - Gate app entry or sensitive actions

Token storage rules:
  ✅ expo-secure-store / react-native-keychain  → encrypted, hardware-backed
  ✅ Flutter secure_storage                     → same
  ❌ AsyncStorage / SharedPreferences           → plain text, not secure
```

---

## App Store & Deployment

```
Versioning:
  → version: "1.2.3"     (user-facing, semver)
  → buildNumber (iOS) / versionCode (Android) — increment every build

Release pipeline:
  → EAS Build (Expo)    → cloud builds for iOS + Android
  → Fastlane            → automate screenshots, signing, upload
  → GitHub Actions      → trigger builds on tag/push

OTA Updates (React Native only):
  → Expo EAS Update     → push JS bundle updates without app store
  → Use for: bug fixes, content changes, non-native changes
  → Cannot update: native modules, permissions, app icons

Staged rollouts:
  → App Store: 1% → 10% → 50% → 100% (phased release)
  → Play Store: rollout % configurable
  → Monitor crash rate before expanding rollout

TestFlight / Internal Testing:
  → Always test on real devices before release
  → TestFlight (iOS): up to 10k external testers
  → Play Store internal track → closed testing → open testing → production
```

---

## Observability (Mobile)

```
Crash reporting:
  → Sentry (React Native + Flutter) — stack traces, session replay
  → Firebase Crashlytics — Google ecosystem, free

Analytics:
  → PostHog (open source, self-hostable)
  → Mixpanel / Amplitude — funnel analysis, retention
  → Firebase Analytics — free, Google ecosystem

Performance monitoring:
  → Sentry Performance — slow renders, API latency from mobile
  → Firebase Performance — network requests, app start time

Key metrics to track:
  → App start time (cold + warm)
  → Screen render time (p95)
  → API error rate (from client perspective)
  → Crash-free sessions %
  → ANR rate (Android Not Responding)
```

---

## Security (Mobile)

```
Data at rest:
  → Sensitive data: expo-secure-store / Keychain (encrypted)
  → Non-sensitive cache: MMKV / AsyncStorage (unencrypted, OK for non-sensitive)
  → DB encryption: SQLCipher (WatermelonDB supports this)

Network:
  → Certificate pinning: pin server cert to prevent MITM
     (expo-ssl-pinning / TrustKit for iOS / OkHttp pinning Android)
  → All traffic over HTTPS / TLS 1.3
  → Validate server cert on every request

Code:
  → Obfuscate production builds (ProGuard / R8 for Android)
  → No secrets in JS bundle — use server-side or secure env
  → Disable debug logs in production builds

Jailbreak / Root detection:
  → react-native-device-info → isRooted()
  → Block sensitive features (banking, healthcare) on rooted devices
```

---

## When to Skip — Opinionated Anti-Patterns

### Skip React Native when:
- App is graphics-heavy (games, custom canvas rendering) → Flutter or native
- Team has no JS/React experience → Flutter's learning curve is similar but output is more consistent
- Heavily platform-specific features (ARKit, HealthKit deep integration) → native Swift/Kotlin

### Skip Flutter when:
- Team is a JS/React shop → React Native reuses existing skills and tooling
- You need OTA updates (fix bugs without app store review) → Flutter has no equivalent to Expo EAS Update
- Web is also a primary surface → Flutter Web is still immature for production

### Skip Offline-First when:
- App is utility / lookup only (calculator, converter, reference) → online-only is simpler
- Data is highly sensitive and must not be stored on device (banking compliance) → online-only with session-only cache
- Real-time accuracy is critical (stock prices, live tracking) → stale local data causes more problems than it solves

### Skip Expo managed workflow when:
- Need deep native module customisation → eject to bare workflow or use React Native CLI directly
- App uses custom native SDKs not in Expo ecosystem → bare workflow from the start

### Skip Push Notifications when:
- B2B internal tool → in-app notifications or email is sufficient
- User opt-in rate is typically < 40% → don't architect around a feature most users will disable