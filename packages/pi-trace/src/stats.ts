import type { Trace } from "./types.js"

export interface StatsSummary {
    totalRounds: number
    totalLlmCalls: number
    totalToolCalls: number
    totalCost: number
    totalDuration: number
    totalInputTokens: number
    totalOutputTokens: number
    toolCallCounts: Record<string, number>
    averageRoundDuration: number
    averageCostPerRound: number
}

export function computeStats(trace: Trace): StatsSummary {
    const toolCallCounts: Record<string, number> = {}
    let totalLlmCalls = 0
    let totalToolCalls = 0
    let totalCost = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalRoundDuration = 0

    for (const round of trace.rounds) {
        totalRoundDuration += round.endTime - round.startTime
        for (const item of round.items) {
            if (item.type === "llm") {
                totalLlmCalls++
                totalCost += item.cost
                totalInputTokens += item.tokens.input
                totalOutputTokens += item.tokens.output
            } else if (item.type === "tool") {
                totalToolCalls++
                toolCallCounts[item.name] = (toolCallCounts[item.name] ?? 0) + 1
            }
        }
    }

    const roundCount = trace.rounds.length
    return {
        totalRounds: roundCount,
        totalLlmCalls,
        totalToolCalls,
        totalCost,
        totalDuration: trace.endTime - trace.startTime,
        totalInputTokens,
        totalOutputTokens,
        toolCallCounts,
        averageRoundDuration: roundCount > 0 ? totalRoundDuration / roundCount : 0,
        averageCostPerRound: roundCount > 0 ? totalCost / roundCount : 0,
    }
}
