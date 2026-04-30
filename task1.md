# pi-trace Step 1 实现总结

## 项目结构

```
pi-trace/
├── package.json                     # npm workspaces 根配置
├── tsconfig.base.json               # 共享 TS 配置 (ES2022, Node16, strict)
├── tsconfig.json                    # 根 tsconfig
├── biome.json                       # 代码格式 (tab 3, line 120)
├── .gitignore
├── AGENTS.md
├── README.md
├── packages/
│   └── pi-trace/                    # 核心包
│       ├── package.json             # name: "pi-trace", 依赖 @mariozechner/pi-agent-core
│       ├── tsconfig.build.json
│       ├── src/
│       │   ├── index.ts             # 公共 API 导出
│       │   ├── trace.ts             # 数据模型
│       │   ├── collector.ts         # 事件采集器
│       │   └── stats.ts             # 统计聚合
│       └── test/
│           ├── collector.test.ts    # 集成测试 (7 tests)
│           └── stats.test.ts        # 单元测试 (5 tests)
└── examples/
    └── with-pi-agent/               # 极简示例 (18 行)
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

## 核心模块

### 数据模型 (`src/trace.ts`)

| 类型 | 字段 | 说明 |
|------|------|------|
| `TraceEvent` | type, ts, seq, data? | 采集到的事件快照，ts=毫秒时间戳，seq=序列号 |
| `TurnMetrics` | turn, startTs, endTs, llmCalls, toolCalls, cost, inputTokens, outputTokens, stopReason | 每个 turn 的完整指标 |
| `Trace` | sessionId, model, startedAt, duration, events[], totals, turnMetrics[], finalMessages[] | 一次 agent run 的完整记录 |

### 采集器 (`src/collector.ts`)

通过 `Agent.subscribe()` 接入，零侵入。

```
Agent ──emit──▶ AgentEvent ──▶ Collector ──notify──▶ DebugAdapter[]
                                                        │
                                                        ├── onEvent(event, { agent })
                                                        └── onTraceComplete(trace)
```

**事件处理逻辑：**
- 为每个 `AgentEvent` 打时间戳 + 序列号，转为 `TraceEvent`
- `tool_execution_start/end`：配对 `toolCallId` 计算耗时
- `turn_end`：从 `AssistantMessage.usage` 提取 tokens/cost，记录 `TurnMetrics`
- `agent_end`：触发 `onTraceComplete()`，传递完整 `Trace`

**边界处理：**
- `maxEvents` 上限（默认 10000），超出丢弃最早事件
- adapter 抛异常或返回 rejected promise 时吞掉，不影响 Agent 运行
- `getTrace()` 在 `start()` 前返回 null

### 统计 (`src/stats.ts`)

`computeStats(trace)` — 纯函数，从 Trace 聚合：

```
StatsSummary { totalTurns, totalLlmCalls, totalToolCalls, totalCost,
               totalDuration, totalInputTokens, totalOutputTokens,
               toolCallCounts, averageTurnDuration, averageCostPerTurn }
```

### 公共 API (`src/index.ts`)

```typescript
export { Collector }              // class
export { computeStats }           // function
export type { DebugAdapter, CollectorOptions }
export type { Trace, TraceEvent, TurnMetrics }
export type { StatsSummary }
```

## 测试

- **12 tests**, 全部通过
- `collector.test.ts` (7)：事件序列、trace 结构、tool 事件、turn metrics、maxEvents 限制、getTrace 前后状态、adapter 容错
- `stats.test.ts` (5)：totals 计算、tool 按名统计、平均耗时、空 trace、非 tool 事件过滤

## 极简示例

```typescript
import { registerFauxProvider, fauxAssistantMessage } from "@mariozechner/pi-ai";
import { Agent } from "@mariozechner/pi-agent-core";
import { Collector, computeStats } from "pi-trace";

const faux = registerFauxProvider();
faux.setResponses([fauxAssistantMessage("Hello world!")]);
const agent = new Agent({ initialState: { model: faux.getModel() } });

const collector = new Collector(agent, {
  adapters: [
    { onEvent: (e) => console.log(e.type), onTraceComplete: (t) => console.log(computeStats(t)) },
  ],
});

collector.start();
await agent.prompt("Hi");
collector.stop();
faux.unregister();
```

运行：`npm -w examples/with-pi-agent run example`

## 依赖关系

```
pi-trace ──depend──▶ @mariozechner/pi-agent-core (runtime)
pi-trace ──dev────▶ @mariozechner/pi-ai          (测试用 faux provider)
                   typescript, vitest, tsx
```

不依赖 `pi-ai`、`pi-tui`、`pi-web-ui`。
