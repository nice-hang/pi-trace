# pi-trace

Agent 调试工具包。

通过 `Agent.subscribe()` 接入 pi-agent 事件流，提供控制台实时输出、JSON 文件导出、CLI 回放等调试能力。

## 安装

```bash
npm install pi-trace
```

## 快速开始

```typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { createTracer, consoleAdapter } from "pi-trace";

const agent = new Agent(/* ... */);

const tracer = createTracer(agent, {
  adapters: [consoleAdapter({ showTimestamps: true })],
});

await agent.prompt("写一个排序算法");
tracer.printSummary();
// → Turn 1: 2.1s, $0.005 (127→45 tokens)
```

## 特性

- **零侵入集成** — 不修改 pi-agent-core 代码，通过 `subscribe()` 接入
- **控制台实时输出** — 带颜色的 Agent 事件流
- **JSON 文件导出** — Agent run 完成后导出结构化 Trace
- **CLI 回放** — 按原始时间间隔重放 Trace 事件
- **统计聚合** — Turn、LLM 调用、Tool 调用、Cost 自动统计

## 使用方式

### 控制台输出

```typescript
import { createTracer, consoleAdapter } from "pi-trace";

createTracer(agent, {
  adapters: [consoleAdapter({ showTimestamps: true, showCost: true })],
});
```

```
━━━ Agent Run ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[16:00:01.123] agent_start
[16:00:01.124] turn_start #1
[16:00:01.250] message_start assistant  (LLM call)
[16:00:03.450] tool_execution_start readFile
[16:00:03.520] tool_execution_end   readFile  (70ms) ✓
[16:00:03.521] message_end assistant  tokens=127→45  cost=$0.003
[16:00:05.600] turn_end #1  2.4s
━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turns:      1
LLM calls:  1
Tool calls: 1 (readFile)
Duration:   4.2s
Cost:       $0.008 (327 in → 89 out)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 文件导出

```typescript
import { createTracer, fileAdapter } from "pi-trace";

createTracer(agent, {
  adapters: [fileAdapter({ dir: "./traces" })],
});
// → ./traces/trace-1714521600123-claude-sonnet-4.json
```

### 自定义 Adapter

```typescript
createTracer(agent, {
  adapters: [{
    onEvent(event, { agent }) {
      if (event.type === "tool_execution_end") {
        console.log(`Tool ${event.data.toolName} took ${event.data.duration}ms`);
      }
    },
    onTraceComplete(trace) {
      console.log(`Cost: $${trace.totals.cost}`);
    },
  }],
});
```

### CLI 回放

```bash
npx pi-trace replay ./trace-xxx.json
npx pi-trace replay ./trace-xxx.json --speed 2
```

## API

### `createTracer(agent, options)`

| 参数 | 类型 | 说明 |
|------|------|------|
| `agent` | `Agent` | pi-agent 实例 |
| `options.adapters` | `DebugAdapter[]` | 一个或多个 adapter |
| `options.maxEvents` | `number` | 最大事件数，默认 10000 |
| `options.recordMessages` | `boolean` | 是否记录完整 messages |

### `consoleAdapter(options?)`

| 选项 | 类型 | 默认值 |
|------|------|--------|
| `showTimestamps` | `boolean` | `true` |
| `showCost` | `boolean` | `true` |
| `eventFilter` | `string[]` | 全部事件 |

### `fileAdapter(options)`

| 选项 | 类型 | 说明 |
|------|------|------|
| `dir` | `string` | 输出目录，必填 |

## 设计原则

- **核心最小，扩展分离** — 调试逻辑不在 agent 核心内，通过 `subscribe()` 接入
- **每一层只做一件事** — Collector 采集，Adapter 输出，互不耦合
- **错误是数据不是控制流** — 初始化/写入失败不影响 Agent 运行
- **YAGNI** — v0.1 只做控制台输出和 JSON 导出

## 四步实现路线图

| Step | 内容 | 关键交付 |
|------|------|----------|
| **Step 1** | 脚手架 + 核心模块 | monorepo 搭建，Trace 类型，Collector，Stats |
| **Step 2** | Adapter | Console 实时输出，File JSON 导出 |
| **Step 3** | CLI | `pi-trace replay` 回放工具 |
| **Step 4** | 完善 | 示例项目，README，CI |

## License

MIT
