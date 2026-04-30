// packages/pi-trace/src/collector.ts
//
// Collector — 通过 Agent.subscribe() 零侵入采集
//
// 用 class 因为需要 start/stop 生命周期管理。
// 用函数的话调用者要自己追踪状态，class 封装得更干净。

import { type Agent, type AgentEvent } from "@mariozechner/pi-agent-core"
import type { ContentBlock, ToolCallTrace, Trace, TurnTrace } from "./types.js"

/** Adapter 接口 — Collector 采集到数据后通知出去 */
export interface TraceAdapter {
	onEvent(event: AgentEvent): void
	onTraceComplete(trace: Trace): void
}

export interface CollectorOptions {
	adapters: TraceAdapter[]
}

/** Collector 内部状态 — 只在运行时存在，agent_end 时冻结为 Trace */
interface CollectorState {
	startTime: number
	model: string
	sessionId: string

	currentTurn: number
	turnStartTime: number
	turnMessages: { role: string; content: ContentBlock[] }[]
	turnToolCalls: Map<string, ToolCallTrace>

	activeToolCalls: Map<string, { name: string; args: unknown; startTime: number }>
	completedTurns: TurnTrace[]

	totalCost: number
	totalInputTokens: number
	totalOutputTokens: number

	// 流式消息累积
	currentMessageContent: ContentBlock[]
	currentMessageRole: string
	currentThinking: string
	currentToolCallId: string
	currentToolName: string
	currentToolArgs: unknown
}

export class Collector {
	private readonly agent: Agent
	private readonly options: Required<CollectorOptions>
	private state: CollectorState | null = null
	private unsubscribe: (() => void) | null = null

	constructor(agent: Agent, options: CollectorOptions) {
		this.agent = agent
		this.options = { adapters: options.adapters }
	}

	start(): void {
		if (this.unsubscribe) return
		this.state = this.createInitialState()
		this.unsubscribe = this.agent.subscribe((event: AgentEvent) => {
			if (!this.state) return
			this.handleEvent(event)
		})
	}

	stop(): void {
		this.unsubscribe?.()
		this.unsubscribe = null
		this.state = null
	}

	getTrace(): Trace | null {
		if (!this.state) return null
		return this.buildTrace(this.state)
	}

	private createInitialState(): CollectorState {
		return {
			startTime: 0, model: "", sessionId: "",
			currentTurn: 0, turnStartTime: 0,
			turnMessages: [], turnToolCalls: new Map(),
			activeToolCalls: new Map(), completedTurns: [],
			totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0,
			currentMessageContent: [], currentMessageRole: "",
			currentThinking: "",
			currentToolCallId: "", currentToolName: "", currentToolArgs: null,
		}
	}

	private handleEvent(event: AgentEvent): void {
		const s = this.state!
		const now = Date.now()

		switch (event.type) {
			case "agent_start":
				s.startTime = now
				s.sessionId = `run-${now}`
				break

			case "turn_start":
				s.currentTurn++
				s.turnStartTime = now
				s.turnMessages = []
				s.turnToolCalls = new Map()
				break

			case "message_start":
				s.currentMessageRole = event.message.role
				s.currentMessageContent = []
				s.currentThinking = ""
				s.currentToolCallId = ""
				s.currentToolName = ""
				s.currentToolArgs = null
				break

			// message_update: 流式消息块到达，assistantMessageEvent 包含 delta
			case "message_update": {
				if (s.currentMessageRole !== "assistant") break
				const upd = event.assistantMessageEvent

				// thinking 是流式的，累积拼接
				if (upd.type === "thinking_delta") {
					s.currentThinking += upd.delta
				}

				// toolcall_end 包含完整的 ToolCall 对象
				if (upd.type === "toolcall_end") {
					s.currentToolCallId = upd.toolCall.id
					s.currentToolName = upd.toolCall.name
					s.currentToolArgs = upd.toolCall.arguments
				}
				break
			}

			// message_end: 消息完成，将累积的内容转为 ContentBlock[]
			case "message_end": {
				if (s.currentMessageRole === "assistant") {
					const blocks: ContentBlock[] = []

					if (s.currentThinking) {
						blocks.push({ type: "thinking", thinking: s.currentThinking })
						s.currentThinking = ""
					}

					if (s.currentToolCallId) {
						blocks.push({
							type: "tool_use",
							name: s.currentToolName,
							input: s.currentToolArgs ?? null,
							id: s.currentToolCallId,
						})
						s.currentToolCallId = ""
						s.currentToolName = ""
						s.currentToolArgs = null
					}

					s.currentMessageContent = blocks
					s.turnMessages.push({ role: "assistant", content: blocks })
				}
				break
			}

			case "tool_execution_start":
				s.activeToolCalls.set(event.toolCallId, {
					name: event.toolName,
					args: event.args,
					startTime: now,
				})
				s.turnToolCalls.set(event.toolCallId, {
					id: event.toolCallId,
					name: event.toolName,
					args: event.args,
					result: undefined,
					isError: false,
					startTime: now,
					endTime: now,
				})
				break

			case "tool_execution_end": {
				const active = s.activeToolCalls.get(event.toolCallId)
				if (active) {
					s.activeToolCalls.delete(event.toolCallId)

					// 更新 tool_use block 中的 input
					for (const msg of s.turnMessages) {
						for (const block of msg.content) {
							if (block.type === "tool_use" && block.id === event.toolCallId) {
								block.input = active.args
							}
						}
					}

					s.turnToolCalls.set(event.toolCallId, {
						id: event.toolCallId,
						name: event.toolName,
						args: active.args,
						result: event.result,
						isError: event.isError,
						startTime: active.startTime,
						endTime: now,
					})
				}
				break
			}

			// turn_end: 一轮结束，组装 TurnTrace
			case "turn_end": {
				const msg = event.message
				const usage = msg.role === "assistant" ? msg.usage : undefined
				const cost = usage?.cost?.total ?? 0
				const iTokens = usage?.input ?? 0
				const oTokens = usage?.output ?? 0
				s.totalCost += cost
				s.totalInputTokens += iTokens
				s.totalOutputTokens += oTokens

				// 从最终的 AssistantMessage.content 提取 blocks 覆盖累积数据
				// 因为 stream 模式下 message_update 可能不完整，最终的 message
				// 才包含完整的 content blocks
				if (msg.role === "assistant" && "content" in msg && msg.content) {
					const finalBlocks: ContentBlock[] = []
					for (const block of msg.content) {
						if (block.type === "text") {
							finalBlocks.push({ type: "text", text: block.text })
						} else if (block.type === "thinking") {
							finalBlocks.push({
								type: "thinking",
								thinking: block.thinking,
								signature: block.thinkingSignature,
							})
						} else if (block.type === "toolCall") {
							finalBlocks.push({
								type: "tool_use",
								name: block.name,
								input: block.arguments,
								id: block.id,
							})
						}
					}

					if (finalBlocks.length > 0) {
						const lastMsg = s.turnMessages[s.turnMessages.length - 1]
						if (lastMsg) {
							lastMsg.content = finalBlocks
						} else {
							s.turnMessages.push({ role: "assistant", content: finalBlocks })
						}
					}
				}

				s.completedTurns.push({
					turn: s.currentTurn,
					startTime: s.turnStartTime,
					endTime: now,
					messages: [...s.turnMessages],
					toolCalls: Array.from(s.turnToolCalls.values()),
					cost,
					inputTokens: iTokens,
					outputTokens: oTokens,
				})
				break
			}

			// agent_end: agent run 完成，通知 adapter
			case "agent_end": {
				s.model = extractModel(event.messages)
				const trace = this.buildTrace(s)
				for (const a of this.options.adapters) {
					try { a.onTraceComplete(trace) } catch { /* adapter 异常不影响 agent */ }
				}
				break
			}

			case "tool_execution_update":
				break
		}
	}

	private buildTrace(s: CollectorState): Trace {
		return {
			sessionId: s.sessionId,
			model: s.model || "unknown",
			startTime: s.startTime,
			endTime: Date.now(),
			turns: [...s.completedTurns],
		}
	}
}

function extractModel(messages: { role: string; model?: string }[]): string {
	for (const msg of messages) {
		if (msg.role === "assistant" && msg.model) {
			return msg.model
		}
	}
	return "unknown"
}
