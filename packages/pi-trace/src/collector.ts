// packages/pi-trace/src/collector.ts

import { type Agent, type AgentEvent } from "@mariozechner/pi-agent-core"
import type { ContentBlock, LlmCall, Round, RoundItem, Session, ToolCall, Trace } from "./types.js"

/** Adapter 接口 — Collector 采集到数据后通知出去 */
export interface TraceAdapter {
    onEvent(event: AgentEvent): void
    onTraceComplete(trace: Trace): void
    onTraceProgress(partialTrace: Trace): void
    onSessionComplete(session: Session): void
}

export interface CollectorOptions {
    adapters: TraceAdapter[]
    sessionId?: string
    metadata?: Record<string, unknown>
}

interface CollectorState {
    // Session
    session: Session

    // 进行中的 Trace
    currentTrace: Trace | null

    // 进行中的 Round
    currentRound: Round | null
    currentLlmCall: LlmCall | null

    // 消息历史 — LLM 看到的所有消息
    messageHistory: { role: string; content: unknown }[]

    // 工具追踪
    activeToolCalls: Map<string, {
        name: string
        args: unknown
        startTime: number
    }>

    // 流式消息累积
    streamRole: string
    streamBlocks: ContentBlock[]
    streamThinking: string
    streamToolCallId: string
    streamToolName: string
    streamToolArgs: unknown
}

export class Collector {
    private readonly agent: Agent
    private readonly options: Required<CollectorOptions>
    private state: CollectorState | null = null
    private unsubscribe: (() => void) | null = null

    constructor(agent: Agent, options: CollectorOptions) {
        this.agent = agent
        this.options = {
            adapters: options.adapters,
            sessionId: options.sessionId ?? `session-${Date.now()}`,
            metadata: options.metadata ?? {},
        }
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
        if (!this.state) return
        if (this.state.currentTrace) {
            this.finalizeTrace()
        }
        const session = this.state.session
        session.endTime = Date.now()
        for (const a of this.options.adapters) {
            try { a.onSessionComplete(session) } catch { /* noop */ }
        }
        this.unsubscribe?.()
        this.unsubscribe = null
        this.state = null
    }

    getSession(): Session | null {
        return this.state?.session ?? null
    }

    private createInitialState(): CollectorState {
        return {
            session: {
                id: this.options.sessionId,
                startTime: Date.now(),
                endTime: 0,
                traces: [],
                metadata: { ...this.options.metadata },
            },
            currentTrace: null,
            currentRound: null,
            currentLlmCall: null,
            messageHistory: [],
            activeToolCalls: new Map(),
            streamRole: "",
            streamBlocks: [],
            streamThinking: "",
            streamToolCallId: "",
            streamToolName: "",
            streamToolArgs: null,
        }
    }

    private emitProgress(): void {
        if (!this.state?.currentTrace) return
        const rounds = [...this.state.currentTrace.rounds]
        if (this.state.currentRound && !rounds.includes(this.state.currentRound)) {
            rounds.push(this.state.currentRound)
        }
        const partial: Trace = { ...this.state.currentTrace, rounds }
        for (const a of this.options.adapters) {
            try { a.onTraceProgress(partial) } catch { /* noop */ }
        }
    }

    private handleEvent(event: AgentEvent): void {
        const s = this.state!
        const now = Date.now()

        switch (event.type) {
            case "agent_start": {
                s.currentTrace = {
                    id: `trace-${now}`,
                    sessionId: s.session.id,
                    model: "unknown",
                    startTime: now,
                    endTime: 0,
                    rounds: [],
                }
                break
            }

            case "turn_start": {
                // 当前消息历史 = LLM 调用的输入
                const inputMessages = [...s.messageHistory]
                const systemPrompt = typeof (this.agent as any).state?.systemPrompt === "string"
                    ? (this.agent as any).state.systemPrompt
                    : ""
                const tools = Array.isArray((this.agent as any).state?.tools)
                    ? (this.agent as any).state.tools.map((t: any) => ({
                        name: t.name ?? "",
                        description: t.description ?? "",
                    }))
                    : undefined

                const llmCall: LlmCall = {
                    type: "llm",
                    input: { system: systemPrompt, messages: inputMessages },
                    tools: tools && tools.length > 0 ? tools : undefined,
                    output: { content: [] },
                    model: "unknown",
                    tokens: { input: 0, output: 0 },
                    cost: 0,
                    timing: { startTime: now, endTime: now },
                }
                const round: Round = {
                    index: (s.currentTrace?.rounds.length ?? 0) + 1,
                    startTime: now,
                    endTime: 0,
                    items: [llmCall],
                }
                s.currentRound = round
                s.currentLlmCall = llmCall
                s.streamBlocks = []
                s.streamThinking = ""
                s.streamToolCallId = ""
                s.streamToolName = ""
                s.streamToolArgs = null
                break
            }

            case "message_start": {
                const msg = event.message
                if (msg.role === "user") {
                    s.messageHistory.push({ role: "user", content: (msg as any).content })
                }
                s.streamRole = msg.role
                if (msg.role === "assistant") {
                    s.streamBlocks = []
                    s.streamThinking = ""
                    s.streamToolCallId = ""
                    s.streamToolName = ""
                    s.streamToolArgs = null
                }
                break
            }

            case "message_update": {
                if (s.streamRole !== "assistant" || !s.currentLlmCall) break
                const upd = event.assistantMessageEvent
                if (upd.type === "thinking_delta") {
                    s.streamThinking += upd.delta
                }
                if (upd.type === "toolcall_end") {
                    s.streamToolCallId = upd.toolCall.id
                    s.streamToolName = upd.toolCall.name
                    s.streamToolArgs = upd.toolCall.arguments
                }
                break
            }

            case "message_end": {
                const msg = event.message
                if (s.streamRole === "assistant" && s.currentLlmCall) {
                    const blocks: ContentBlock[] = []
                    if (s.streamThinking) {
                        blocks.push({ type: "thinking", thinking: s.streamThinking })
                        s.streamThinking = ""
                    }
                    if (s.streamToolCallId) {
                        blocks.push({
                            type: "tool_use",
                            name: s.streamToolName,
                            input: s.streamToolArgs ?? null,
                            id: s.streamToolCallId,
                        })
                        s.streamToolCallId = ""
                        s.streamToolName = ""
                        s.streamToolArgs = null
                    }
                    s.streamBlocks = blocks
                    s.currentLlmCall.output.content = blocks

                    // turn_end 的最终消息覆盖流式累积内容
                    if ("content" in msg && Array.isArray(msg.content)) {
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
                            s.currentLlmCall.output.content = finalBlocks
                        }
                    }

                    // 模型响应完成 — 记录精确的 endTime（不含后续工具执行时间）
                    s.currentLlmCall.timing.endTime = now
                }
                this.emitProgress()
                break
            }

            case "tool_execution_start": {
                s.activeToolCalls.set(event.toolCallId, {
                    name: event.toolName,
                    args: event.args,
                    startTime: now,
                })
                break
            }

            case "tool_execution_end": {
                const active = s.activeToolCalls.get(event.toolCallId)
                if (active) {
                    s.activeToolCalls.delete(event.toolCallId)
                    const tc: ToolCall = {
                        type: "tool",
                        name: event.toolName,
                        input: { args: active.args },
                        output: { result: event.result },
                        isError: event.isError,
                        timing: { startTime: active.startTime, endTime: now },
                    }
                    // 加入消息历史（tool result 是下一轮 LLM 的上下文）
                    s.messageHistory.push({
                        role: "tool",
                        content: event.result,
                    } as any)
                    // 加入当前 Round
                    if (s.currentRound) {
                        s.currentRound.items.push(tc)
                        s.currentRound.endTime = now
                    }
                    this.emitProgress()
                }
                break
            }

            case "turn_end": {
                const msg = event.message
                // 从返回消息中提取真实模型名
                const msgModel = (msg as any)?.model
                if (msgModel && s.currentTrace) {
                    s.currentTrace.model = msgModel
                }
                if (s.currentLlmCall) {
                    const usage = (msg as any).usage
                    const cost = usage?.cost?.total ?? 0
                    const iTokens = usage?.input ?? 0
                    const oTokens = usage?.output ?? 0
                    s.currentLlmCall.tokens = { input: iTokens, output: oTokens }
                    s.currentLlmCall.cost = cost
                    // endTime 已在 message_end 中设置（不含工具执行时间）
                    // 若 message_end 未触发（如异常），才在这里兜底
                    if (s.currentLlmCall.timing.endTime <= s.currentLlmCall.timing.startTime) {
                        s.currentLlmCall.timing.endTime = now
                    }
                    s.currentLlmCall.model = msgModel || s.currentTrace?.model || "unknown"

                    // 捕获 stopReason
                    if ("stopReason" in msg) {
                        s.currentLlmCall.stopReason = (msg as any).stopReason
                    }
                }
                if (s.currentRound) {
                    s.currentRound.endTime = now
                }
                // assistant 消息记入历史（下一轮 LLM 的上下文）
                if (s.currentLlmCall) {
                    s.messageHistory.push({
                        role: "assistant",
                        content: s.currentLlmCall.output.content,
                    })
                }
                // Round 加入 Trace
                if (s.currentRound && s.currentTrace) {
                    s.currentTrace.rounds.push(s.currentRound)
                }
                this.emitProgress()
                s.currentRound = null
                s.currentLlmCall = null
                break
            }

            case "agent_end": {
                if (s.currentTrace) {
                    const messages = event.messages
                    s.currentTrace.model = extractModel(messages)
                    s.currentTrace.endTime = Date.now()
                    s.session.traces.push(s.currentTrace)
                    const trace = s.currentTrace
                    s.currentTrace = null
                    for (const a of this.options.adapters) {
                        try { a.onTraceComplete(trace) } catch { /* noop */ }
                    }
                }
                break
            }

            case "tool_execution_update":
                break
        }
    }

    private finalizeTrace(): void {
        if (this.state?.currentRound && this.state?.currentTrace) {
            this.state.currentRound.endTime = Date.now()
            this.state.currentTrace.rounds.push(this.state.currentRound)
        }
        if (this.state?.currentTrace) {
            this.state.currentTrace.endTime = Date.now()
            this.state.session.traces.push(this.state.currentTrace)
        }
        this.state!.currentRound = null
        this.state!.currentLlmCall = null
        this.state!.currentTrace = null
    }
}

function extractModel(messages: { role: string; model?: string }[]): string {
    for (const msg of messages) {
        if (msg.role === "assistant" && msg.model) return msg.model
    }
    return "unknown"
}
