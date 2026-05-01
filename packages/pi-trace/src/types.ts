// packages/pi-trace/src/types.ts
//
// pi-trace 数据模型 v2
//
// Session - 调试会话（Collector 生命周期）
//   └── Trace - 一次 agent.prompt()
//         └── Round - 一个响应周期
//               └── items[] - 平级时间线
//                     ├── LlmCall
//                     ├── ToolCall
//                     └── SystemMessage

/** 消息内容块（不变） */
export type ContentBlock =
    | { type: "text"; text: string }
    | { type: "thinking"; thinking: string; signature?: string }
    | { type: "tool_use"; name: string; input: unknown; id: string }

/** 一次 LLM 调用的完整记录 */
export interface LlmCall {
    type: "llm"
    input: {
        system: string
        messages: { role: string; content: unknown }[]
    }
    tools?: {
        name: string
        description: string
    }[]
    output: {
        content: ContentBlock[]
    }
    model: string
    tokens: { input: number; output: number }
    cost: number
    timing: { startTime: number; endTime: number }
    stopReason?: string
}

/** 一次工具调用的完整记录 */
export interface ToolCall {
    type: "tool"
    name: string
    input: { args: unknown }
    output: { result: unknown }
    isError: boolean
    timing: { startTime: number; endTime: number }
}

/** 系统事件（steering / followup / pruned / error） */
export interface SystemMessage {
    type: "system"
    role: "steering" | "followup" | "pruned" | "error"
    content: string
    timestamp: number
}

export type RoundItem = LlmCall | ToolCall | SystemMessage

/** 一个响应周期 */
export interface Round {
    index: number
    startTime: number
    endTime: number
    items: RoundItem[]
}

/** 一次 agent.prompt() 的完整记录 */
export interface Trace {
    id: string
    sessionId: string
    model: string
    startTime: number
    endTime: number
    rounds: Round[]
}

/** 调试会话（Collector 生命周期） */
export interface Session {
    id: string
    startTime: number
    endTime: number
    traces: Trace[]
    metadata?: Record<string, unknown>
}
