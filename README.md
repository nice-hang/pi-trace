# pi-tracing

Real-time observability for [pi-agent](https://github.com/mariozechner/pi-agent-core) agents.

Hooks into `Agent.subscribe()` with zero code changes — captures thinking, tool calls, and LLM turns into structured data, then serves a live web dashboard.

```typescript
createTracer(agent).serve()
```

## Install

```bash
npm install pi-tracing
```

## Quick Start

```typescript
import { Agent } from "@mariozechner/pi-agent-core"
import { createTracer } from "pi-tracing"

const agent = new Agent({ /* ... */ })
const tracer = createTracer(agent)
tracer.serve()

await agent.prompt("What is the capital of France?")
```

Open `http://localhost:3333` — the dashboard shows sessions, traces, LLM calls, tool calls, and thinking blocks in a resizable three-panel layout.

## Features

- **Zero-instrumentation** — plugs in via `Agent.subscribe()`, no agent code changes
- **Real-time streaming** — SSE pushes live traces to the dashboard as they happen
- **Resizable three-panel UI** — session list, trace tree, detail inspector with drag handles
- **Rich content rendering** — Markdown, collapsible thinking blocks, tool call JSON with syntax highlighting
- **Structured trace data** — LLM calls (messages, tokens, cost), tool calls (args, results), system events
- **Theme support** — light/dark toggle, persists preference
- **Session management** — multi-session history, grouped by conversation

## Architecture

```
Agent events ──▶ Collector ──▶ TracerServer ──▶ Dashboard (SSE)
                   │               │
               Session/Trace    /api/sessions
               Round/Item      Static UI (React 19 + shadcn/ui)
```

**Data model:** `Session ▶ Trace ▶ Round ▶ {LlmCall | ToolCall | SystemMessage}`

Each level preserves the full decision chain — thinking content, tool inputs and results, token usage, and cost.

## API

### `createTracer(agent, options?)`


| Param               | Type     | Default | Description                |
| ------------------- | -------- | ------- | -------------------------- |
| `agent`             | `Agent`  | —       | pi-agent instance          |
| `options.port`      | `number` | `3333`  | Web UI port                |
| `options.sessionId` | `string` | auto    | Custom session identifier  |
| `options.metadata`  | `object` | —       | Attach metadata to session |


Returns a `Tracer` with `serve()` and `newSession()`.

### `computeStats(trace)`

Returns aggregated metrics: turns, LLM/tool call counts, total cost, token usage, average round duration.

### Trace Adapter

Collector accepts custom `TraceAdapter` for integration with external observability pipelines:

```typescript
const collector = new Collector(agent, {
  adapters: [{
    onEvent(event) { /* raw agent events */ },
    onTraceComplete(trace) { /* finalized trace */ },
    onTraceProgress(trace) { /* partial trace during streaming */ },
    onSessionComplete(session) { /* finalized session */ },
  }]
})
```

## Examples

```bash
# basic — simple prompt with faux LLM
npm -w examples/basic run example

# with-tools — real LLM + bash/fetch tools
export ANTHROPIC_API_KEY=sk-...
npm -w examples/with-tools run example "what time is it"
```

## Design

- **Core minimal, extension separate** — debugging never pollutes agent internals
- **Single responsibility** — Collector captures, Server serves, UI renders
- **Errors are data** — adapter failures never break the agent
- **SSE over WebSocket** — unidirectional push, auto-reconnect, zero dependencies
- **Node http over Express** — two routes don't need a framework
- **Preact → React 19** — migrated for richer component ecosystem (shadcn/ui)

## Changelog

Generated from conventional commits via [git-cliff](https://git-cliff.org):

```bash
pnpm changelog          # full changelog
pnpm changelog:unreleased  # unreleased changes only
```

## License

MIT