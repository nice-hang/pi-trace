// packages/pi-trace/ui/src/components/SessionList.tsx
//
// SessionList — 最左栏，列出所有 Session

import type { Session } from "pi-trace"
import { ScrollArea } from "./ui/scroll-area.js"

interface SessionListProps {
    sessions: Session[]
    selectedId: string | null
    onSelect: (id: string) => void
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
    return (
        <div className="h-full flex flex-col bg-panel">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-panel-border">
                Sessions ({sessions.length})
            </div>
            <ScrollArea className="flex-1">
                <div className="py-1">
                    {sessions.length === 0 && (
                        <div className="p-4 text-xs text-gray-600 text-center">No sessions</div>
                    )}
                    {sessions.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => onSelect(s.id)}
                            className={`w-full text-left px-3 py-2 text-xs border-b border-panel-border transition-colors ${
                                s.id === selectedId
                                    ? "bg-blue-900/30 text-blue-300 border-l-2 border-l-blue-500"
                                    : "text-gray-400 hover:bg-surface"
                            }`}
                        >
                            <div className="font-medium truncate text-foreground">{s.id}</div>
                            <div className="text-gray-500 mt-0.5">
                                {s.traces.length} trace(s)
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
