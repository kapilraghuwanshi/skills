# AI Layer Reference

## Should this system have an AI layer?

```
Does the system need to understand language, generate content,
reason over data, or make intelligent decisions?
  → YES → Include AI layer
  → NO  → Skip this layer. State: "No AI layer needed."
```

## Model Selection

| Model | When | Latency | Cost |
|-------|------|---------|------|
| GPT-4o | Complex reasoning, multimodal, tool use | ~2–5s | $$$ |
| Claude 3.5 Sonnet | Balanced reasoning + speed, long context | ~1–3s | $$ |
| Gemini 1.5 Pro | Long context (1M tokens), Google ecosystem | ~2–4s | $$ |
| GPT-4o-mini / Claude Haiku | Fast, cheap, simple tasks (classify, extract) | ~300ms | $ |
| Open source (Llama 3, Mistral) | Data privacy, on-prem, no API cost | Varies | Infra cost |

### Model routing pattern (cost control):
```
Simple task (classify, short extract)?
  → Use cheap model (Haiku / GPT-4o-mini)
Complex task (reasoning, generation, analysis)?
  → Use powerful model (Sonnet / GPT-4o)
Latency critical + simple?
  → Use fast model + cache the result
```

## Integration Patterns

### Direct API Call
```
User request → Backend → LLM API → Response
```
- Simplest. Use when: single-turn, no memory, no retrieval needed.
- Watch: latency is unpredictable. Always set timeout + fallback.

### MCP (Model Context Protocol) servers

**What it is:** a standard way for agents to discover and call **tools** (APIs, DBs, files, internal services) through **MCP servers** instead of ad-hoc integrations.

```
Agent (Claude / custom orchestrator)
    ↓ MCP client
MCP server(s) — each exposes tools + resources
    ↓
Your systems: REST, SQL, Slack, GitHub, runbooks, etc.
```

**When to include in architecture**

- Product is **agent-first** (coding agents, support copilots, ops agents) and you want **composable tools** with a consistent permission model.
- You need **separation**: MCP server enforces auth + rate limits; LLM only sees tool schemas.

**Design notes**

- One MCP server per **domain** (e.g. billing-readonly, docs-search) — smaller blast radius.
- Tools should be **idempotent** or explicitly document side effects.
- Log **tool calls** (arguments redacted) for audit and debugging.
- Host MCP alongside your API or as sidecars; secure with mTLS or token auth from the agent runtime.

### RAG (Retrieval Augmented Generation)
```
User query
    ↓
Embed query → Vector DB search → Retrieve top-K chunks
    ↓
Prompt = system + retrieved context + user query
    ↓
LLM generates grounded response
```
- Use when: system needs to answer from private / domain-specific data
- Components: embedding model (OpenAI ada-002 / Cohere), vector DB (Pinecone / Weaviate / pgvector)
- Chunking strategy: 512–1024 tokens per chunk, 10–20% overlap
- Re-ranking: use cross-encoder to re-rank retrieved chunks before prompting

### Fine-tuning
- Use when: consistent style/format is critical, base model doesn't follow domain conventions
- Expensive. Try RAG + few-shot prompting first.
- Fine-tune on: labelled input/output pairs, domain-specific examples

## Context Window Management

```
Input too long for context window?

Option 1 — Chunking + map-reduce
  → Split into chunks → process each → merge results
  → Use for: document summarisation, long reports

Option 2 — Sliding window
  → Keep last N tokens in context, drop oldest
  → Use for: long conversations, chat history

Option 3 — Summarisation
  → Periodically summarise conversation history
  → Inject summary as system context
  → Use for: multi-turn agents, long sessions

Option 4 — Select + inject
  → Use RAG to select only relevant sections
  → Don't put entire document in context
  → Use for: knowledge base Q&A
```

## Prompt Strategy

```
System prompt:
  → Define role, constraints, output format
  → Be explicit: "Respond only in JSON", "Never make up citations"
  → Keep stable (cache system prompt tokens where possible)

Few-shot examples:
  → 2–5 input/output examples in system or user turn
  → Dramatically improves output consistency
  → Update examples when output quality degrades

Chain of thought:
  → "Think step by step before answering"
  → Improves reasoning quality for complex tasks
  → Costs more tokens — use for accuracy-critical paths only

Output format:
  → Always specify format: JSON, markdown, bullet list
  → Use Zod / JSON schema validation on the output
  → Retry once if output fails schema validation
```

## Latency Budget for AI Calls

```
Total p95 target: 300ms (non-AI), 3000ms (AI-heavy)

Break down budget per tier:
  Network to LLM API:    ~100ms
  LLM processing:        ~500ms–3000ms (model dependent)
  Post-processing:       ~50ms
  Total AI path:         ~1–4s

Strategies to stay in budget:
  → Stream responses (show tokens as they arrive — perceived latency drops)
  → Cache frequent prompts + responses (Redis, semantic cache)
  → Run AI async (don't block user action — process in background, push result)
  → Use smaller model for non-critical paths
```

## Reliability + Fallback

```
LLM API is down / timeout?
  → Return cached response (if available)
  → Return graceful degraded response ("Feature temporarily unavailable")
  → Never surface raw LLM errors to users

Rate limit hit?
  → Exponential backoff + retry (3 attempts max)
  → Queue excess requests (don't drop them)
  → Alert on sustained rate limit hits (capacity planning signal)

Bad output (failed schema validation)?
  → Retry once with "Your previous response was invalid JSON. Try again."
  → Log the failure (track output quality over time)
  → Fallback to rule-based response if retry fails
```

## Cost Control

```
1. Cache AI responses
   → Same prompt + same context → same response (use Redis, TTL 1hr–24hr)
   → Semantic cache: embed the query, find similar past queries (GPTCache)

2. Batch where possible
   → Don't call LLM per-item in a loop
   → Batch embed, batch classify, batch extract

3. Model routing
   → Simple tasks → cheap model
   → Complex tasks → expensive model
   → Gate by task complexity classifier

4. Token budgeting
   → Set max_tokens limits explicitly (don't let model run unbounded)
   → Trim unnecessary context before sending
   → Monitor tokens per request (cost scales linearly)

5. Async processing
   → Defer non-urgent AI tasks to background jobs
   → Cheaper compute, no latency pressure
```

---

## When to Skip — Opinionated Anti-Patterns

### Skip RAG when:
- Knowledge base < 50 documents → just put them in the system prompt
- Data changes every hour → index freshness becomes a full-time problem
- Team has no vector DB experience → start with prompt stuffing, add RAG when context limit is the actual bottleneck

### Skip Fine-tuning when:
- You haven't tried few-shot prompting yet → fine-tuning is 100x more expensive and slow
- Dataset < 1000 labelled examples → not enough signal, model won't generalise
- Use case is reasoning / instruction-following → base models already excel here

### Skip GPT-4o when:
- Task is classification, extraction, summarisation → Claude Haiku / GPT-4o-mini is 10x cheaper and fast enough
- Latency target < 500ms → GPT-4o averages 2–5s, use smaller model or cache

### Skip streaming when:
- Response is used programmatically (parsed as JSON) → streaming adds complexity with no UX benefit
- Response < 200 tokens → not perceptible to users, regular response is fine

### Skip AI layer entirely when:
- The feature can be done with deterministic logic (filtering, sorting, rule-based decisions)
- Budget is < $100/mo and DAU < 1k → AI API cost at low scale is proportionally high
- Latency requirement is < 100ms → no current LLM fits this budget reliably