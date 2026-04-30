import type { Trace } from "./types.js";

export interface StatsSummary {
	totalTurns: number
	totalLlmCalls: number
	totalToolCalls: number
	totalCost: number
	totalDuration: number
	totalInputTokens: number
	totalOutputTokens: number
	toolCallCounts: Record<string, number>
	averageTurnDuration: number
	averageCostPerTurn: number
}

export function computeStats(trace: Trace): StatsSummary {
	const toolCallCounts: Record<string, number> = {}

	for (const turn of trace.turns) {
		for (const tc of turn.toolCalls) {
			toolCallCounts[tc.name] = (toolCallCounts[tc.name] ?? 0) + 1
		}
	}

	const turnCount = trace.turns.length
	const avgTurnDuration =
		turnCount > 0
			? trace.turns.reduce((sum, t) => sum + (t.endTime - t.startTime), 0) / turnCount
			: 0

	const avgCostPerTurn =
		turnCount > 0
			? trace.turns.reduce((sum, t) => sum + t.cost, 0) / turnCount
			: 0

	return {
		totalTurns: trace.turns.length,
		totalLlmCalls: trace.turns.reduce((sum, t) => sum + (t.messages.filter(m => m.role === "assistant").length), 0),
		totalToolCalls: trace.turns.reduce((sum, t) => sum + t.toolCalls.length, 0),
		totalCost: trace.turns.reduce((sum, t) => sum + t.cost, 0),
		totalDuration: trace.endTime - trace.startTime,
		totalInputTokens: trace.turns.reduce((sum, t) => sum + t.inputTokens, 0),
		totalOutputTokens: trace.turns.reduce((sum, t) => sum + t.outputTokens, 0),
		toolCallCounts,
		averageTurnDuration: avgTurnDuration,
		averageCostPerTurn: avgCostPerTurn,
	}
}
