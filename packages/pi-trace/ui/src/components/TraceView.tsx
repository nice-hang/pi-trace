// packages/pi-trace/ui/src/components/TraceView.tsx

import { useState, useEffect } from "react"
import { Sun, Moon } from "lucide-react"
import type { Session, Trace } from "pi-trace"
import { SessionList } from "./SessionList.js"
import { TreePanel } from "./TreePanel.js"
import type { TreeNode } from "./TreePanel.js"
import { DetailPanel } from "./DetailPanel.js"
import { Button } from "./ui/button.js"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable.js"

function getInitialTheme(): "dark" | "light" {
  const stored = localStorage.getItem("pi-trace-theme")
  if (stored === "light" || stored === "dark") return stored
  return "light"
}

export function TraceView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [liveTrace, setLiveTrace] = useState<Trace | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme)

  // Sync theme to <html> and localStorage
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("pi-trace-theme", theme)
  }, [theme])

  useEffect(() => {
    const es = new EventSource("/events")
    es.onmessage = (msg) => {
      let parsed: { type: string; data: unknown }
      try { parsed = JSON.parse(msg.data) } catch { return }

      if (parsed.type === "session_list") {
        const list = parsed.data as Session[]
        setSessions(list)
        setLiveTrace(null)
        setSelectedSessionId((prev) => {
          if (!prev && list.length > 0) return list[list.length - 1].id
          return prev
        })
      } else if (parsed.type === "trace_progress") {
        setLiveTrace(parsed.data as Trace)
      } else {
        setEventCount((c) => c + 1)
      }
    }
    return () => es.close()
  }, [])

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            liveTrace
              ? "bg-green-500 animate-pulse shadow-[0_0_6px_#00e676]"
              : "bg-gray-600"
          }`}
        />
        <span className="font-medium text-foreground">pi-trace</span>
        {liveTrace && (
          <span className="text-[10px] uppercase tracking-wider text-green-500 font-medium">
            Live
          </span>
        )}
        <span className="text-muted-foreground">{eventCount} events</span>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </Button>
      </header>

      {/* 可拖拽三栏 */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
      >
        <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
          <SessionList
            sessions={sessions}
            selectedId={selectedSessionId}
            onSelect={(id) => {
              setSelectedSessionId(id)
              setSelectedNode(null)
            }}
          />
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-border hover:bg-blue-500/50 transition-colors data-[resize-handle-active]:bg-blue-500" />

        <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
          <TreePanel
            session={selectedSession}
            selectedNode={selectedNode}
            onSelect={setSelectedNode}
            liveTrace={liveTrace}
          />
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-border hover:bg-blue-500/50 transition-colors data-[resize-handle-active]:bg-blue-500" />

        <ResizablePanel defaultSize={50} minSize={25} maxSize={70}>
          <DetailPanel node={selectedNode} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
