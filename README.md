# pi-tracing

If your agent is built on [pi-mono](https://github.com/badlogic/pi-mono), `pi-tracing` is your best choice for real-time observability — **just 3 lines of code**.

```typescript
import { createTracer } from "pi-tracing"

const tracer = createTracer(agent)
tracer.serve()
```

No agent code changes needed. Automatically captures thinking, tool calls, and LLM turns, then serves a live web dashboard.

## Quick Start

```bash
npm install pi-tracing
```

```typescript
import { Agent } from "@mariozechner/pi-agent-core"
import { createTracer } from "pi-tracing"

const agent = new Agent({ /* ... */ })
const tracer = createTracer(agent)
tracer.serve()

await agent.prompt("What is the capital of France?")
```

Open `http://localhost:3333` for the live trace dashboard.

## Features

- **Zero instrumentation** — plugs in via `Agent.subscribe()`, no agent code changes
- **Real-time streaming** — SSE pushes live traces to the browser
- **Three-panel UI** — session list, trace tree, detail inspector with drag handles
- **Rich rendering** — Markdown, collapsible thinking blocks, tool call JSON with syntax highlighting
- **Structured data** — LLM calls (messages, tokens, cost), tool calls (args, results)
- **Session management** — multi-session history, grouped by conversation
- **Theme support** — light/dark toggle

## Architecture

```
Agent events ──▶ Collector ──▶ TracerServer ──▶ Dashboard (SSE)
                   │               │
               Session/Trace    /api/sessions
               Round/Item      Static UI (React 19 + shadcn/ui)
```

**Data model:** `Session ▶ Trace ▶ Round ▶ {LlmCall | ToolCall | SystemMessage}`

## API

| Param                | Type     | Default | Description               |
| -------------------- | -------- | ------- | ------------------------- |
| `agent`              | `Agent`  | —       | pi-agent instance         |
| `options.port`       | `number` | `3333`  | Dashboard port            |
| `options.sessionId`  | `string` | auto    | Custom session ID         |
| `options.metadata`   | `object` | —       | Attach metadata to session|

### Trace Adapter

Integrate with external observability pipelines:

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
# basic — faux LLM, no API key required
npm -w examples/basic run example

# with-tools — real LLM + bash/fetch tools
npm -w examples/with-tools run example
```

## License

MIT