// packages/pi-trace/ui/src/components/ContentRenderer.tsx
//
// ContentRenderer — 将 ContentBlock[] 渲染为 Markdown、可折叠 thinking、JSON 高亮 tool_use

import type { ContentBlock } from "pi-trace"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "./ui/collapsible.js"

function TextBlock({ text }: { text: string }) {
    return (
        <div className={`text-xs text-foreground leading-relaxed [&_pre]:bg-panel [&_pre]:border [&_pre]:border-panel-border [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-foreground [&_h1]:text-sm [&_h1]:font-medium [&_h2]:text-sm [&_h2]:font-medium [&_h3]:text-xs [&_h3]:font-medium [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-blue-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-700 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_blockquote]:italic [&_table]:w-full [&_th]:text-left [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_tr]:border-b [&_tr]:border-panel-border]`}>
            <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
            >
                {text}
            </Markdown>
        </div>
    )
}

function ThinkingBlock({ thinking }: { thinking: string }) {
    return (
        <Collapsible className={`border border-panel-border rounded overflow-hidden`}>
            <CollapsibleTrigger className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500 hover:bg-surface transition-colors`}>
                <span className="text-gray-600">▶</span>
                <span className="italic">thinking...</span>
                <span className="text-gray-600 ml-auto">{thinking.length} chars</span>
            </CollapsibleTrigger>
            <CollapsibleContent className={`px-3 py-2 text-xs text-gray-400 italic whitespace-pre-wrap border-t border-panel-border`}>
                {thinking}
            </CollapsibleContent>
        </Collapsible>
    )
}

function ToolUseBlock({ name, input }: { name: string; input: unknown }) {
    return (
        <div className={`bg-amber-950/20 border border-amber-800/30 rounded overflow-hidden`}>
            <div className={`flex items-center gap-2 px-3 py-1.5 bg-amber-950/30 text-xs font-medium text-amber-400 border-b border-amber-800/30`}>
                <span>🛠</span> {name}
            </div>
            <pre className="p-3 text-xs text-gray-300 overflow-x-auto">
                <code>{JSON.stringify(input, null, 2)}</code>
            </pre>
        </div>
    )
}

export function ContentRenderer({ blocks }: { blocks: ContentBlock[] }) {
    if (blocks.length === 0) {
        return <div className="text-gray-600 italic text-xs">No content</div>
    }

    return (
        <div className="space-y-2">
            {blocks.map((block, i) => {
                switch (block.type) {
                    case "text":
                        return <TextBlock key={i} text={block.text} />
                    case "thinking":
                        return <ThinkingBlock key={i} thinking={block.thinking} />
                    case "tool_use":
                        return <ToolUseBlock key={i} name={block.name} input={block.input} />
                }
            })}
        </div>
    )
}
