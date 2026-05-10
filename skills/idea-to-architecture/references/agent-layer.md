# Agent Layer Reference

## Should this system have an agent layer?

```
Does the system need to:
  - Take autonomous multi-step actions?
  - Use external tools or APIs to complete tasks?
  - Make decisions based on intermediate results?
  - Run long-horizon tasks without step-by-step human input?
  → YES → Include agent layer
  → NO  → Skip. State: "No agent layer needed — direct AI API calls are sufficient."
```

## Agent Patterns

### Single Agent
```
User → Agent (LLM + tools) → Result
```
- Simplest. Use when: one domain, < 5 tools, tasks complete in 1–3 steps.
- Example: a coding assistant with file read/write/search tools.

### Multi-Agent (Orchestrator + Workers)
```
User → Orchestrator Agent
           ↓
    ┌──────┼──────┐
    ↓      ↓      ↓
 Agent A  Agent B  Agent C
(search) (write) (review)
```
- Use when: task spans multiple domains, parallelism improves speed.
- Orchestrator: plans, delegates, aggregates results.
- Workers: specialised, scoped, stateless where possible.

### Agent as Microservice
```
Each agent runs as an independent service:
  → Has its own LLM calls, tools, memory
  → Communicates via message queue (Kafka) or API
  → Can scale independently
  → Isolated failures don't cascade
```
- Use at scale or when agents have very different load profiles.

## What Goes Inside an Agent

```
Agent = LLM + Tools + Memory + Loop

Tools:    External capabilities (search, DB query, API call, file ops, MCP tools)
Memory:   Short-term (context window) + Long-term (vector DB / key-value store)
Loop:     Reason → Act → Observe → Reason → ... → Done
```

### Tool Design Rules
- Each tool does ONE thing (single responsibility)
- Tools return structured data (JSON), not prose
- Tools are idempotent where possible (safe to retry)
- Always set timeout on every tool call
- Log every tool call + result (observability)

## Agent Orchestration Patterns

### Sequential
```
Step 1 → Step 2 → Step 3 → Result
```
- Use when: steps depend on each other's output
- Simple but slow (each step waits for previous)

### Parallel
```
         ┌→ Step A ─┐
Input ───┤→ Step B ─├→ Aggregate → Result
         └→ Step C ─┘
```
- Use when: steps are independent
- Faster. Aggregate results with a merge step.

### Hierarchical
```
Manager Agent
  → Planner Agent
  → Executor Agents (parallel)
  → Reviewer Agent
```
- Use for complex long-horizon tasks
- Manager owns the goal, delegates sub-goals

## Communication Between Agents

| Pattern | When | NFR |
|---------|------|-----|
| Direct API call | Low latency, synchronous, simple | Latency |
| Message queue (Kafka) | Decoupled, async, durable | Resilience |
| Shared state (Redis) | Agents need to coordinate on same data | Real-time |
| Event stream | One agent's output triggers another | Maintainability |

## Memory Patterns

```
Short-term (within a session):
  → Context window (last N messages)
  → Summarise old history to compress

Long-term (across sessions):
  → Vector DB: semantic search over past interactions (Pinecone / pgvector)
  → Key-value store: structured facts about user/entity (Redis)
  → Graph DB: relationships between entities (Neo4j) — use rarely

Working memory (task-specific):
  → Scratchpad: intermediate reasoning steps (chain of thought)
  → Task state: current step, results so far, next actions
```

## Fault Tolerance

```
Agent fails mid-task?
  → Checkpoint: save progress to DB at each step
  → Resume from last checkpoint (not from scratch)

Tool call fails?
  → Retry with backoff (max 3 attempts)
  → Try alternative tool if available
  → Report failure to orchestrator → decide to skip or abort

Agent stuck in loop?
  → Max iteration limit (e.g. 10 steps max)
  → Timeout on entire task (e.g. 30s wall clock)
  → Return best partial result + flag for human review

Cascade failure?
  → Bulkhead: agent failures don't crash the main service
  → Dead letter queue: failed tasks go here for manual review
```

## Human-in-the-Loop

```
When to pause and ask a human:
  → Low confidence decision (LLM confidence < threshold)
  → Irreversible action (delete, send email, charge payment)
  → Ambiguous instruction ("update the file" — which file?)
  → Security-sensitive action (access control changes)

Implementation:
  → Agent emits "needs_approval" event
  → Task pauses, human notified (email / Slack / UI)
  → Human approves/rejects via API
  → Agent resumes or aborts
```

## Observability for Agents

```
Log every:
  → Agent invocation (input, tools available, model used)
  → Tool call (name, input, output, latency)
  → LLM call (prompt tokens, completion tokens, latency, cost)
  → Decision point (what the agent chose and why)
  → Final output (result, steps taken, total latency, total cost)

Trace E2E with OpenTelemetry:
  → Span per agent step
  → Parent span for the whole task
  → Link to user session for debugging

Alert on:
  → Task failure rate > threshold
  → Average steps per task increasing (agent getting confused)
  → Tool error rate spike
  → Cost per task exceeding budget
```