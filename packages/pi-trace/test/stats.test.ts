import { describe, expect, it } from "vitest"
import { computeStats } from "../src/stats.js"
import type { Trace } from "../src/types.js"

describe("computeStats", () => {
    it("空 trace 统计", () => {
        const trace: Trace = {
            id: "test", sessionId: "s1", model: "claude",
            startTime: 0, endTime: 1000, rounds: [],
        }
        const stats = computeStats(trace)
        expect(stats.totalRounds).toBe(0)
        expect(stats.totalCost).toBe(0)
    })

    it("统计 LLM 和工具调用", () => {
        const trace: Trace = {
            id: "test", sessionId: "s1", model: "claude",
            startTime: 0, endTime: 2000,
            rounds: [{
                index: 1, startTime: 0, endTime: 1000,
                items: [
                    {
                        type: "llm",
                        input: { messages: [] },
                        output: { content: [] },
                        model: "claude",
                        tokens: { input: 100, output: 50 },
                        cost: 0.002,
                        timing: { startTime: 0, endTime: 500 },
                    } as any,
                    {
                        type: "tool",
                        name: "bash",
                        input: { args: { command: "date" } },
                        output: { result: "Fri May 1" },
                        isError: false,
                        timing: { startTime: 500, endTime: 700 },
                    } as any,
                ],
            }],
        }
        const stats = computeStats(trace)
        expect(stats.totalRounds).toBe(1)
        expect(stats.totalLlmCalls).toBe(1)
        expect(stats.totalToolCalls).toBe(1)
        expect(stats.totalCost).toBe(0.002)
        expect(stats.totalInputTokens).toBe(100)
        expect(stats.totalOutputTokens).toBe(50)
        expect(stats.toolCallCounts).toEqual({ bash: 1 })
    })
})
