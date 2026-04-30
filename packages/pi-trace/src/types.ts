// packages/pi-trace/src/types.ts
//
// pi-trace 数据模型
//
// 核心思路：agent 的每条消息由若干 ContentBlock 构成。
// 不直接用 pi-agent-core 的 AgentMessage 是因为它包含运行时状态。
// Trace 需要不可变的快照。

/** 消息内容块 */
export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; signature?: string }
	| { type: "tool_use"; name: string; input: unknown; id: string }

/** 一次 tool 调用的完整记录 */
export interface ToolCallTrace {
	id: string
	name: string
	args: unknown
	result?: unknown
	isError: boolean
	startTime: number
	endTime: number
}

/** 一轮 LLM 对话的完整快照 */
export interface TurnTrace {
	turn: number
	startTime: number
	endTime: number
	messages: { role: string; content: ContentBlock[] }[]
	toolCalls: ToolCallTrace[]
	cost: number
	inputTokens: number
	outputTokens: number
}

/** 一次 agent run 的完整记录 */
export interface Trace {
	sessionId: string
	model: string
	startTime: number
	endTime: number
	turns: TurnTrace[]
}
