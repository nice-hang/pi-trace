import {
    type FauxProviderRegistration,
    fauxAssistantMessage,
    fauxText,
    fauxToolCall,
    registerFauxProvider,
} from "@mariozechner/pi-ai"
import { Agent } from "@mariozechner/pi-agent-core"
import { afterEach, describe, expect, it } from "vitest"
import { Collector } from "../src/collector.js"
import type { TraceAdapter } from "../src/collector.js"
import type { Session, Trace } from "../src/types.js"

const registrations: FauxProviderRegistration[] = []

afterEach(() => {
    while (registrations.length > 0) {
        registrations.pop()?.unregister()
    }
})

function createFaux(): FauxProviderRegistration {
    const faux = registerFauxProvider()
    registrations.push(faux)
    return faux
}

describe("Collector", () => {
    it("采集简单 prompt 生成 session + trace + round", async () => {
        const faux = createFaux()
        faux.setResponses([fauxAssistantMessage("Hello!")])

        const agent = new Agent({ initialState: { model: faux.getModel() } })
        let session: Session | undefined
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [adapter], sessionId: "test-session" })
        collector.start()
        await agent.prompt("Hi")
        collector.stop()

        expect(session).toBeDefined()
        expect(session!.id).toBe("test-session")
        expect(session!.traces.length).toBe(1)
        expect(session!.traces[0].rounds.length).toBeGreaterThanOrEqual(1)
    })

    it("LlmCall 包含 input messages", async () => {
        const faux = createFaux()
        faux.setResponses([fauxAssistantMessage("Hello back!")])

        const agent = new Agent({ initialState: { model: faux.getModel() } })
        let session: Session | undefined
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [adapter] })
        collector.start()
        await agent.prompt("Hi there")
        collector.stop()

        const trace = session!.traces[0]
        expect(trace.rounds.length).toBeGreaterThanOrEqual(1)
        const round = trace.rounds[0]
        const llmCall = round.items.find(i => i.type === "llm")
        expect(llmCall).toBeDefined()
        if (llmCall?.type === "llm") {
            expect(Array.isArray(llmCall.input.messages)).toBe(true)
            expect(Array.isArray(llmCall.output.content)).toBe(true)
        }
    })

    it("工具调用生成 ToolCall item", async () => {
        const faux = createFaux()
        faux.setResponses([
            fauxAssistantMessage([
                fauxText("Let me calculate."),
                fauxToolCall("calculate", { expression: "2 + 2" }),
            ]),
        ])

        const agent = new Agent({ initialState: { model: faux.getModel() } })
        let session: Session | undefined
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [adapter] })
        collector.start()
        await agent.prompt("Calculate 2+2")
        collector.stop()

        const trace = session!.traces[0]
        expect(trace.rounds.length).toBeGreaterThanOrEqual(1)
        const toolCalls = trace.rounds.flatMap(r => r.items.filter(i => i.type === "tool"))
        expect(toolCalls.length).toBeGreaterThanOrEqual(0)
    })

    it("多次 prompt 生成多条 trace", async () => {
        const faux = createFaux()
        faux.setResponses([
            fauxAssistantMessage("First."),
            fauxAssistantMessage("Second."),
        ])

        const agent = new Agent({ initialState: { model: faux.getModel() } })
        let session: Session | undefined
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [adapter] })
        collector.start()
        await agent.prompt("First prompt")
        await agent.prompt("Second prompt")
        collector.stop()

        expect(session).toBeDefined()
        expect(session!.traces.length).toBe(2)
    })

    it("adapter 异常不影响 Collector 运行", async () => {
        const faux = createFaux()
        faux.setResponses([fauxAssistantMessage("Hello!")])

        const agent = new Agent({ initialState: { model: faux.getModel() } })
        let session: Session | undefined
        const throwingAdapter: TraceAdapter = {
            onEvent() { throw new Error("adapter error") },
            onTraceComplete() { throw new Error("trace error") },
            onSessionComplete() { throw new Error("session error") },
        }
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [throwingAdapter, adapter] })
        collector.start()
        await agent.prompt("Hi")
        collector.stop()

        expect(session).toBeDefined()
        expect(session!.traces.length).toBeGreaterThanOrEqual(1)
    })

    it("getSession() 正确返回 session", () => {
        const faux = createFaux()
        const agent = new Agent({ initialState: { model: faux.getModel() } })
        const collector = new Collector(agent, { adapters: [] })
        expect(collector.getSession()).toBeNull()
        collector.start()
        expect(collector.getSession()).not.toBeNull()
        expect(collector.getSession()!.id).toBeTruthy()
        collector.stop()
    })

    it("采集 system prompt", async () => {
        const faux = createFaux()
        faux.setResponses([fauxAssistantMessage("Hello!")])

        const agent = new Agent({
            initialState: {
                model: faux.getModel(),
                systemPrompt: "You are a helpful assistant.",
            },
        })
        let session: Session | undefined
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [adapter] })
        collector.start()
        await agent.prompt("Hi")
        collector.stop()

        const trace = session!.traces[0]
        const llmCall = trace.rounds[0].items.find(i => i.type === "llm")
        expect(llmCall).toBeDefined()
        if (llmCall?.type === "llm") {
            expect(llmCall.input.system).toBe("You are a helpful assistant.")
        }
    })

    it("采集 tools 信息", async () => {
        const faux = createFaux()
        faux.setResponses([
            fauxAssistantMessage([
                fauxText("Let me calculate."),
                fauxToolCall("calculate", { expression: "2 + 2" }),
            ]),
        ])

        const agent = new Agent({
            initialState: { model: faux.getModel() },
        })
        agent.state.tools = [
            {
                name: "calculate",
                description: "Execute a calculation",
                parameters: { type: "object", properties: {} },
            } as any,
        ]
        let session: Session | undefined
        const adapter: TraceAdapter = {
            onEvent() {},
            onTraceComplete() {},
            onSessionComplete(s) { session = s },
        }

        const collector = new Collector(agent, { adapters: [adapter] })
        collector.start()
        await agent.prompt("Calculate 2+2")
        collector.stop()

        const trace = session!.traces[0]
        const llmCall = trace.rounds[0].items.find(i => i.type === "llm")
        expect(llmCall).toBeDefined()
        if (llmCall?.type === "llm") {
            expect(llmCall.tools).toBeDefined()
            expect(llmCall.tools!.length).toBeGreaterThanOrEqual(1)
            expect(llmCall.tools![0].name).toBe("calculate")
            expect(llmCall.tools![0].description).toBe("Execute a calculation")
        }
    })
})
