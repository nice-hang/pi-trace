// packages/pi-trace/ui/src/components/DetailPanel.tsx
//
// DetailPanel — 最右栏，展示选中节点的详情，使用 ContentRenderer 和 shadcn 组件

import { ChevronRight } from "lucide-react"
import type { Trace, Round, LlmCall, ToolCall, SystemMessage, ContentBlock } from "pi-trace"
import { ContentRenderer } from "./ContentRenderer.js"
import { JsonView } from "./JsonView.js"
import type { TreeNode } from "./TreePanel.js"
import { Badge } from "./ui/badge.js"
import { ScrollArea } from "./ui/scroll-area.js"
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "./ui/collapsible.js"
import { Tabs, TabsList, TabsTab, TabsPanel } from "./ui/tabs.js"

function toContentBlocks(content: unknown): ContentBlock[] {
    if (typeof content === "string") return [{ type: "text", text: content }]
    if (Array.isArray(content)) return content
    if (content !== null && content !== undefined) {
        return [{ type: "text", text: JSON.stringify(content, null, 2) }]
    }
    return []
}

interface DetailPanelProps {
    node: TreeNode | null
}

function MetadataRow({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex justify-between py-1 text-xs">
            <span className="text-gray-500">{label}</span>
            <span className={color ?? "text-foreground"}>{value}</span>
        </div>
    )
}

function MetadataCard({ children }: { children: React.ReactNode }) {
    return (
        <div className={`bg-panel border border-panel-border rounded p-3 space-y-1`}>
            {children}
        </div>
    )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-xs font-medium text-gray-500 mb-1">{children}</div>
    )
}

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + "k"
    return String(n)
}

function TraceDetail({ trace }: { trace: Trace }) {
    const totalCost = trace.rounds.reduce((s, r) => {
        return s + r.items.reduce((s2, i) => s2 + (i.type === "llm" ? i.cost : 0), 0)
    }, 0)
    const totalTokens = trace.rounds.reduce((s, r) => {
        const roundTokens = r.items.reduce((s2, i) => {
            if (i.type === "llm") return { in: s2.in + i.tokens.input, out: s2.out + i.tokens.output }
            return s2
        }, { in: 0, out: 0 })
        return { in: s.in + roundTokens.in, out: s.out + roundTokens.out }
    }, { in: 0, out: 0 })

    return (
        <div className="p-4 space-y-3">
            <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Badge variant="default" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/20">Trace</Badge>
                {trace.id}
            </h2>
            <MetadataCard>
                <MetadataRow label="Model" value={trace.model} color="text-blue-300" />
                <MetadataRow
                    label="Duration"
                    value={trace.endTime ? `${trace.endTime - trace.startTime}ms` : "In progress..."}
                    color={trace.endTime ? "text-foreground" : "text-green-400"}
                />
                <MetadataRow label="Rounds" value={String(trace.rounds.length)} />
                <MetadataRow label="Total Cost" value={`$${totalCost.toFixed(4)}`} />
                <MetadataRow label="Tokens" value={`${fmt(totalTokens.in + totalTokens.out)} total  (${fmt(totalTokens.in)} in / ${fmt(totalTokens.out)} out)`} />
            </MetadataCard>
        </div>
    )
}

function RoundDetail({ round }: { round: Round }) {
    const llmItems = round.items.filter(i => i.type === "llm") as LlmCall[]
    const toolItems = round.items.filter(i => i.type === "tool") as ToolCall[]
    const totalCost = llmItems.reduce((s, i) => s + i.cost, 0)

    return (
        <div className="p-4 space-y-3">
            <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">Round</Badge>
                Round {round.index}
            </h2>
            <MetadataCard>
                <MetadataRow
                    label="Duration"
                    value={round.endTime ? `${round.endTime - round.startTime}ms` : "In progress..."}
                    color={round.endTime ? "text-foreground" : "text-green-400"}
                />
                <MetadataRow label="LLM Calls" value={String(llmItems.length)} />
                <MetadataRow label="Tool Calls" value={String(toolItems.length)} />
                <MetadataRow label="Cost" value={`$${totalCost.toFixed(4)}`} />
            </MetadataCard>
        </div>
    )
}

function LlmCallDetail({ item }: { item: LlmCall }) {
    return (
        <div className="p-4 space-y-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/20">LLM Call</Badge>
                {item.model}
            </h2>

            <Tabs defaultValue="overview">
                <TabsList className="w-full">
                    <TabsTab value="overview">Overview</TabsTab>
                    <TabsTab value="tools">Tools</TabsTab>
                    <TabsTab value="input">Input</TabsTab>
                    <TabsTab value="output">Output</TabsTab>
                </TabsList>

                <TabsPanel value="overview">
                    <MetadataCard>
                        <MetadataRow label="Model" value={item.model} />
                        {item.stopReason && (
                            <div className="flex justify-between py-1 text-xs">
                                <span className="text-gray-500">Stop Reason</span>
                                <Badge className={
                                    item.stopReason === "stop" ? "bg-green-500/20 text-green-400"
                                    : item.stopReason === "toolUse" ? "bg-amber-500/20 text-amber-400"
                                    : item.stopReason === "length" ? "bg-orange-500/20 text-orange-400"
                                    : item.stopReason === "error" || item.stopReason === "aborted"
                                        ? "bg-red-500/20 text-red-400"
                                        : "bg-gray-500/20 text-gray-400"
                                }>{item.stopReason}</Badge>
                            </div>
                        )}
                        <MetadataRow label="Tokens" value={`${fmt(item.tokens.input + item.tokens.output)} total  (${fmt(item.tokens.input)} in / ${fmt(item.tokens.output)} out)`} />
                        <MetadataRow label="Cost" value={`$${item.cost.toFixed(4)}`} />
                        <MetadataRow
                            label="Duration"
                            value={item.timing.endTime ? `${Math.round(item.timing.endTime - item.timing.startTime)}ms` : "..."}
                        />
                        <MetadataRow label="Tool Definitions" value={item.tools ? String(item.tools.length) : "0"} />
                        <MetadataRow label="Messages" value={String(item.input.messages.length)} />
                    </MetadataCard>
                </TabsPanel>

                <TabsPanel value="tools">
                    {item.tools && item.tools.length > 0 ? (
                        <div className="space-y-1">
                            {item.tools.map((tool: { name: string; description: string }, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-panel border border-panel-border rounded px-3 py-1.5">
                                    <span className="text-green-400 font-medium">{tool.name}</span>
                                    <span className="text-gray-500">{tool.description}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 py-4 text-center">No tools configured</div>
                    )}
                </TabsPanel>

                <TabsPanel value="input" className="space-y-2">
                    <Collapsible defaultOpen={true}>
                        <CollapsibleTrigger className="group flex items-center gap-2 w-full text-xs font-medium text-gray-400 py-1 cursor-pointer">
                            <ChevronRight className="size-3 text-gray-500 transition-transform group-aria-expanded:rotate-90" />
                            System Prompt
                            {item.input.system && <span className="text-gray-600 ml-auto">{item.input.system.length} chars</span>}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1">
                            <div className="bg-panel border border-panel-border rounded p-3 max-h-60 overflow-y-auto">
                                {item.input.system ? (
                                    <ContentRenderer blocks={[{ type: "text", text: item.input.system }]} />
                                ) : (
                                    <span className="text-gray-500 italic">No system prompt</span>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <Collapsible defaultOpen={true}>
                        <CollapsibleTrigger className="group flex items-center gap-2 w-full text-xs font-medium text-gray-400 py-1 cursor-pointer">
                            <ChevronRight className="size-3 text-gray-500 transition-transform group-aria-expanded:rotate-90" />
                            Messages ({item.input.messages.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1">
                            <JsonView data={item.input.messages} maxHeight="20rem" />
                        </CollapsibleContent>
                    </Collapsible>
                </TabsPanel>

                <TabsPanel value="output">
                    <ContentRenderer blocks={item.output.content} />
                </TabsPanel>
            </Tabs>
        </div>
    )
}

function ToolCallDetail({ item }: { item: ToolCall }) {
    return (
        <div className="p-4 space-y-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
                <Badge className={item.isError ? "bg-red-500/20 text-red-400 hover:bg-red-500/20" : "bg-green-500/20 text-green-400 hover:bg-green-500/20"}>
                    {item.isError ? "Error" : "Tool"}
                </Badge>
                {item.name}
                <span className="text-xs text-gray-600 ml-auto">
                    {Math.round(item.timing.endTime - item.timing.startTime)}ms
                </span>
            </h2>

            <div>
                <SectionHeader>Arguments</SectionHeader>
                <JsonView data={item.input.args} />
            </div>

            {item.output.result !== undefined && (
                <div>
                    <SectionHeader>Result</SectionHeader>
                    {item.isError ? (
                        <div className="bg-red-950/20 border border-red-800/30 rounded p-3">
                            <JsonView data={item.output.result} />
                        </div>
                    ) : (
                        <JsonView data={item.output.result} />
                    )}
                </div>
            )}

            <MetadataCard>
                <MetadataRow label="Duration" value={`${Math.round(item.timing.endTime - item.timing.startTime)}ms`} />
                {item.isError && <MetadataRow label="Status" value="Error" color="text-red-400" />}
            </MetadataCard>
        </div>
    )
}

function SystemDetail({ item }: { item: SystemMessage }) {
    return (
        <div className="p-4 space-y-2">
            <h2 className="text-sm font-medium flex items-center gap-2">
                <Badge className="bg-gray-500/20 text-gray-400">System</Badge>
                {item.role}
            </h2>
            <div className={`text-xs text-gray-400 whitespace-pre-wrap bg-panel border border-panel-border rounded p-3`}>
                {item.content}
            </div>
        </div>
    )
}

export function DetailPanel({ node }: DetailPanelProps) {
    if (!node) {
        return (
            <div className={`h-full flex items-center justify-center text-sm text-gray-600 bg-panel`}>
                Select a node to view details
            </div>
        )
    }

    return (
        <ScrollArea className={`h-full bg-panel`}>
            {(() => {
                switch (node.kind) {
                    case "trace":
                        return <TraceDetail trace={node.trace} />
                    case "round":
                        return <RoundDetail round={node.round} />
                    case "item":
                        switch (node.item.type) {
                            case "llm":
                                return <LlmCallDetail item={node.item} />
                            case "tool":
                                return <ToolCallDetail item={node.item} />
                            case "system":
                                return <SystemDetail item={node.item} />
                        }
                }
            })()}
        </ScrollArea>
    )
}
