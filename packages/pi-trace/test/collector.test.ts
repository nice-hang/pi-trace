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
import type { Trace } from "../src/types.js"

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
	it("collects events and builds structured trace", async () => {
		const faux = createFaux()
		faux.setResponses([fauxAssistantMessage("Hello!")])

		const agent = new Agent({ initialState: { model: faux.getModel() } })
		let trace: Trace | undefined
		const adapter: TraceAdapter = {
			onEvent() {},
			onTraceComplete(t) { trace = t },
		}

		const collector = new Collector(agent, { adapters: [adapter] })
		collector.start()
		await agent.prompt("Hi")
		collector.stop()

		expect(trace).toBeDefined()
		expect(trace!.sessionId).toMatch(/^run-/)
		expect(trace!.turns.length).toBeGreaterThanOrEqual(1)
	})

	it("turns have correct structure", async () => {
		const faux = createFaux()
		faux.setResponses([fauxAssistantMessage("Hello!")])

		const agent = new Agent({ initialState: { model: faux.getModel() } })
		let trace: Trace | undefined
		const adapter: TraceAdapter = {
			onEvent() {},
			onTraceComplete(t) { trace = t },
		}

		const collector = new Collector(agent, { adapters: [adapter] })
		collector.start()
		await agent.prompt("Hi")
		collector.stop()

		expect(trace).toBeDefined()
		const turn = trace!.turns[0]
		expect(turn.turn).toBe(1)
		expect(turn.startTime).toBeGreaterThan(0)
		expect(turn.endTime).toBeGreaterThanOrEqual(turn.startTime)
		expect(turn.toolCalls).toBeDefined()
	})

	it("tracks tool calls with results", async () => {
		const faux = createFaux()
		faux.setResponses([
			fauxAssistantMessage([
				fauxText("Let me calculate."),
				fauxToolCall("calculate", { expression: "2 + 2" }),
			]),
		])

		const agent = new Agent({ initialState: { model: faux.getModel() } })
		let trace: Trace | undefined
		const adapter: TraceAdapter = {
			onEvent() {},
			onTraceComplete(t) { trace = t },
		}

		const collector = new Collector(agent, { adapters: [adapter] })
		collector.start()
		await agent.prompt("Calculate 2+2")
		collector.stop()

		expect(trace).toBeDefined()
		expect(trace!.turns.length).toBeGreaterThanOrEqual(1)
	})

	it("handles multiple prompts across runs", async () => {
		const faux = createFaux()
		faux.setResponses([
			fauxAssistantMessage("First response."),
			fauxAssistantMessage("Second response."),
		])

		const agent = new Agent({ initialState: { model: faux.getModel() } })
		let trace: Trace | undefined
		const adapter: TraceAdapter = {
			onEvent() {},
			onTraceComplete(t) { trace = t },
		}

		const collector = new Collector(agent, { adapters: [adapter] })
		collector.start()
		await agent.prompt("First prompt")
		await agent.prompt("Second prompt")
		collector.stop()

		expect(trace).toBeDefined()
		expect(trace!.turns.length).toBe(2)
	})

	it("returns null from getTrace() before start", () => {
		const faux = createFaux()
		const agent = new Agent({ initialState: { model: faux.getModel() } })
		const collector = new Collector(agent, { adapters: [] })
		expect(collector.getTrace()).toBeNull()
	})

	it("survives adapter errors without crashing", async () => {
		const faux = createFaux()
		faux.setResponses([fauxAssistantMessage("Hello!")])

		const agent = new Agent({ initialState: { model: faux.getModel() } })

		const throwingAdapter: TraceAdapter = {
			onEvent() { throw new Error("adapter error") },
			onTraceComplete() { throw new Error("trace error") },
		}

		let trace: Trace | undefined
		const adapter: TraceAdapter = {
			onEvent() {},
			onTraceComplete(t) { trace = t },
		}

		const collector = new Collector(agent, { adapters: [throwingAdapter, adapter] })
		collector.start()
		await agent.prompt("Hi")
		collector.stop()

		expect(trace).toBeDefined()
		expect(trace!.turns.length).toBeGreaterThanOrEqual(1)
	})
})
