// packages/pi-trace/ui/src/components/JsonView.tsx
//
// JsonView — lightweight JSON syntax highlighter

import { useState, useCallback } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "./ui/button.js"

const tokenColors: Record<string, string> = {
    key: "text-blue-400",
    str: "text-teal-400",
    num: "text-amber-300",
    bool: "text-purple-400",
    nil: "text-gray-500",
}

function highlightJson(json: string): string {
    const escaped = json
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    return escaped.replace(
        /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false)\b|\b(null)\b/g,
        (_match, key, str, num, bool, nil) => {
            if (key) return `<span class="${tokenColors.key}">${key}</span>:`
            if (str) return `<span class="${tokenColors.str}">${str}</span>`
            if (num) return `<span class="${tokenColors.num}">${num}</span>`
            if (bool) return `<span class="${tokenColors.bool}">${bool}</span>`
            if (nil) return `<span class="${tokenColors.nil}">${nil}</span>`
            return _match
        }
    )
}

export function JsonView({
    data,
    maxHeight,
}: {
    data: unknown
    maxHeight?: string
}) {
    const [copied, setCopied] = useState(false)

    let json: string
    try {
        json = JSON.stringify(data, null, 2)
    } catch {
        json = String(data)
    }

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(json).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }, [json])

    const html = highlightJson(json)

    return (
        <div className="relative group">
            <Button
                variant="ghost"
                size="icon-xs"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleCopy}
                aria-label="Copy JSON"
            >
                {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
            </Button>
            <pre
                className={`text-xs overflow-x-auto whitespace-pre-wrap bg-panel border border-panel-border rounded p-3 ${
                    maxHeight ? `overflow-y-auto` : ""
                }`}
                style={maxHeight ? { maxHeight } : undefined}
            >
                <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
        </div>
    )
}
