// packages/pi-trace/ui/src/components/TreePanel.tsx
//
// TreePanel — 中间栏，层级树展示

import { useState } from "react"
import { ChevronRight } from "lucide-react"

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + "k"
    return String(n)
}
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import type { Session, Trace, Round, RoundItem } from "pi-trace"

import { Badge } from "./ui/badge.js"
import { Button } from "./ui/button.js"
import { Collapsible, CollapsibleContent } from "./ui/collapsible.js"
import { ScrollArea } from "./ui/scroll-area.js"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group.js"

interface FilterType {
    type: "all" | "llm" | "tool" | "error"
}

function computeStats(traces: Trace[]) {
    let rounds = 0, llmCalls = 0, toolCalls = 0, errors = 0
    let totalCost = 0, totalDuration = 0
    for (const trace of traces) {
        totalDuration = Math.max(totalDuration, (trace.endTime || Date.now()) - trace.startTime)
        for (const round of trace.rounds) {
            rounds++
            for (const item of round.items) {
                if (item.type === "llm") { llmCalls++; totalCost += item.cost }
                if (item.type === "tool") { toolCalls++; if (item.isError) errors++ }
            }
        }
    }
    return { rounds, llmCalls, toolCalls, errors, totalCost, totalDuration }
}

type TreeNode =
    | { kind: "trace"; trace: Trace }
    | { kind: "round"; round: Round }
    | { kind: "item"; item: RoundItem }

interface TreePanelProps {
    session: Session | null
    selectedNode: TreeNode | null
    onSelect: (node: TreeNode) => void
    liveTrace?: Trace | null
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString()
}

export type { TreeNode }

function ItemRow({ item, selectedNode, onSelect }: {
    item: RoundItem
    selectedNode: TreeNode | null
    onSelect: (node: TreeNode) => void
}) {
    const isSelected = selectedNode?.kind === "item" && selectedNode.item === item
    if (item.type === "llm") {
        return (
            <Button
                variant={isSelected ? "selected" : "ghost"}
                size="sm"
                className="w-full justify-start rounded-none text-xs"
                onClick={() => onSelect({ kind: "item", item })}
            >
                <span className="w-1 h-full rounded-full bg-blue-400 shrink-0 mr-1.5" />
                <span className="text-blue-400 font-medium shrink-0">LLM</span>
                <span className="text-gray-400 truncate mx-1">{item.model}</span>
                <span className="text-gray-600">{fmt(item.tokens.input + item.tokens.output)}</span>
                <span className="text-gray-600 ml-auto">
                    {item.timing.endTime ? `${Math.round(item.timing.endTime - item.timing.startTime)}ms` : "..."}
                </span>
            </Button>
        )
    }
    if (item.type === "tool") {
        const duration = Math.round(item.timing.endTime - item.timing.startTime)
        return (
            <Button
                variant={isSelected ? "selected" : "ghost"}
                size="sm"
                className={`w-full justify-start rounded-none text-xs ${item.isError ? "border-l-2 border-l-red-500" : ""}`}
                onClick={() => onSelect({ kind: "item", item })}
            >
                <span className={`w-1 h-full rounded-full shrink-0 mr-1.5 ${item.isError ? "bg-red-400" : "bg-green-400"}`} />
                <span className={item.isError ? "text-red-400 font-medium shrink-0" : "text-green-400 font-medium shrink-0"}>
                    {item.isError ? "ERR" : "Tool"}
                </span>
                <span className="text-gray-400 truncate mx-1">{item.name}</span>
                <span className="text-gray-600 text-[10px] line-clamp-1">
                    {typeof item.input.args === "object"
                        ? JSON.stringify(item.input.args).slice(0, 40)
                        : String(item.input.args).slice(0, 40)}
                </span>
                <span className="text-gray-600 ml-auto">{duration}ms</span>
            </Button>
        )
    }
    // system
    return (
        <Button
            variant={isSelected ? "selected" : "ghost"}
            size="sm"
            className="w-full justify-start rounded-none text-xs"
            onClick={() => onSelect({ kind: "item", item })}
        >
            <span className="w-1 h-full rounded-full bg-gray-500 shrink-0 mr-1.5" />
            <span className="text-gray-500 font-medium shrink-0">Sys</span>
            <span className="text-gray-500 truncate ml-1">{item.role}</span>
        </Button>
    )
}

function RoundRow({ round, selectedNode, onSelect, filter }: {
    round: Round
    selectedNode: TreeNode | null
    onSelect: (node: TreeNode) => void
    filter: FilterType
}) {
    const isSelected = selectedNode?.kind === "round" && selectedNode.round.index === round.index
    const roundDuration = round.endTime ? round.endTime - round.startTime : 0
    const llmCount = round.items.filter(i => i.type === "llm").length
    const toolCount = round.items.filter(i => i.type === "tool").length
    const errorCount = round.items.filter(i => i.type === "tool" && i.isError).length
    const filteredItems = round.items.filter(item => {
        if (filter.type === "all") return true
        if (filter.type === "llm") return item.type === "llm"
        if (filter.type === "tool") return item.type === "tool"
        if (filter.type === "error") return item.type === "tool" && item.isError
        return true
    })
    if (filteredItems.length === 0 && filter.type !== "all") return null
    return (
        <Collapsible defaultOpen>
            <CollapsiblePrimitive.Trigger
                render={
                    <Button
                        variant={isSelected ? "selected" : "ghost"}
                        size="sm"
                        className="w-full justify-start rounded-none text-xs group"
                    />
                }
            >
                <ChevronRight className="size-2.5 text-gray-500 transition-transform group-aria-expanded:rotate-90" />
                <span className="text-gray-400">Round {round.index}</span>
                <span className="text-gray-600 ml-2">{roundDuration}ms</span>
                <span className="text-gray-600 ml-auto">
                    {llmCount > 0 && <span className="text-blue-400">LLM x{llmCount}</span>}
                    {llmCount > 0 && toolCount > 0 && <span className="text-gray-600"> · </span>}
                    {toolCount > 0 && <span className={errorCount > 0 ? "text-red-400" : "text-green-400"}>
                        Tool x{toolCount}{errorCount > 0 ? ` (${errorCount} err)` : ""}
                    </span>}
                </span>
            </CollapsiblePrimitive.Trigger>
            <CollapsibleContent className="ml-3 border-l border-panel-border">
                {filteredItems.map((item, i) => (
                    <ItemRow key={i} item={item} selectedNode={selectedNode} onSelect={onSelect} />
                ))}
            </CollapsibleContent>
        </Collapsible>
    )
}

function TraceTreeRows({ trace, selectedNode, onSelect, filter }: {
    trace: Trace
    selectedNode: TreeNode | null
    onSelect: (node: TreeNode) => void
    filter: FilterType
}) {
    const isSelected = selectedNode?.kind === "trace" && selectedNode.trace.id === trace.id
    const filteredRounds = trace.rounds.filter(round => {
        if (filter.type === "all") return true
        return round.items.some(item => {
            if (filter.type === "llm") return item.type === "llm"
            if (filter.type === "tool") return item.type === "tool"
            if (filter.type === "error") return item.type === "tool" && item.isError
            return true
        })
    })
    return (
        <Collapsible defaultOpen>
            <CollapsiblePrimitive.Trigger
                render={
                    <Button
                        variant={isSelected ? "selected" : "ghost"}
                        size="sm"
                        className="w-full justify-start rounded-none group"
                    />
                }
            >
                <ChevronRight className="size-3 text-gray-500 transition-transform group-aria-expanded:rotate-90" />
                <Badge variant="default" className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0">
                    Trace
                </Badge>
                <span className="text-sm text-foreground">{trace.model}</span>
                <span className="text-xs text-gray-600 ml-2">{formatTime(trace.startTime)}</span>
            </CollapsiblePrimitive.Trigger>
            <CollapsibleContent className="ml-3 border-l border-panel-border">
                {filteredRounds.map(round => (
                    <RoundRow key={round.index} round={round} selectedNode={selectedNode} onSelect={onSelect} filter={filter} />
                ))}
            </CollapsibleContent>
        </Collapsible>
    )
}

export function TreePanel({ session, selectedNode, onSelect, liveTrace }: TreePanelProps) {
    const [filter, setFilter] = useState<FilterType>({ type: "all" })
    const stats = computeStats(session?.traces ?? [])
    const hasLiveTrace = liveTrace && !session?.traces.find(t => t.id === liveTrace.id)

    return (
        <div className="h-full flex flex-col bg-panel border-r border-panel-border">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-panel-border">
                {session?.id ?? "Traces"}
            </div>
            <div className="px-3 py-2 border-b border-panel-border space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{stats.rounds} rounds</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-blue-400">{stats.llmCalls} LLM</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-green-400">{stats.toolCalls} tools</span>
                    {stats.errors > 0 && (
                        <>
                            <span className="text-gray-600">·</span>
                            <span className="text-red-400">{stats.errors} error{stats.errors > 1 ? "s" : ""}</span>
                        </>
                    )}
                    <span className="ml-auto">
                        ${stats.totalCost.toFixed(4)} · {stats.totalDuration}ms
                    </span>
                </div>
                <ToggleGroup
                    value={[filter.type]}
                    onValueChange={(v) => v.length > 0 && setFilter({ type: v[0] as unknown as FilterType["type"] })}
                >
                    <ToggleGroupItem value="all" size="xs">All</ToggleGroupItem>
                    <ToggleGroupItem value="llm" size="xs">LLM</ToggleGroupItem>
                    <ToggleGroupItem value="tool" size="xs">Tool</ToggleGroupItem>
                    <ToggleGroupItem value="error" size="xs">Error</ToggleGroupItem>
                </ToggleGroup>
            </div>
            <ScrollArea className="flex-1">
                {session && (
                    <div className="py-1">
                        {session.traces.length === 0 && !hasLiveTrace && (
                            <div className="p-4 text-xs text-gray-600">Waiting for trace...</div>
                        )}
                        {session.traces.map((trace) => (
                            <TraceTreeRows
                                key={trace.id}
                                trace={trace}
                                selectedNode={selectedNode}
                                onSelect={onSelect}
                                filter={filter}
                            />
                        ))}
                    </div>
                )}

                {/* LIVE trace 区块 */}
                {hasLiveTrace && liveTrace && (
                    <div>
                        <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-gray-600 uppercase tracking-wider border-t border-panel-border mt-2 pt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Live
                        </div>
                        <TraceTreeRows
                            trace={liveTrace}
                            selectedNode={selectedNode}
                            onSelect={onSelect}
                            filter={filter}
                        />
                    </div>
                )}

                {!session && !hasLiveTrace && (
                    <div className="p-4 text-xs text-gray-600 text-center">Select a session</div>
                )}
            </ScrollArea>
        </div>
    )
}
