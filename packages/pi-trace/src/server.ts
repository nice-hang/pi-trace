// packages/pi-trace/src/server.ts

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { join, extname } from "node:path"
import { fileURLToPath } from "node:url"
import { exec } from "node:child_process"
import type { TraceAdapter } from "./collector.js"
import type { Session, Trace } from "./types.js"
import type { AgentEvent } from "@mariozechner/pi-agent-core"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

const MIME: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
}

export class TracerServer {
    private port: number
    private clients: Set<ServerResponse> = new Set()
    private buffer: unknown[] = []
    private sessions: Session[] = []

    constructor(options?: { port?: number }) {
        this.port = options?.port ?? 3333
    }

    setPort(port: number): void {
        this.port = port
    }

    getAdapter(): TraceAdapter {
        return {
            onEvent: (event: AgentEvent) => {
                this.broadcast({ type: "event", data: event })
            },
            onTraceComplete: (trace: Trace) => {
                // 维护 server 端 sessions 状态（Collector 可能还没 stop）
                let session = this.sessions.find(s => s.id === trace.sessionId)
                if (!session) {
                    session = {
                        id: trace.sessionId,
                        startTime: trace.startTime,
                        endTime: trace.endTime,
                        traces: [],
                    }
                    this.sessions.push(session)
                }
                const idx = session.traces.findIndex(t => t.id === trace.id)
                if (idx >= 0) {
                    session.traces[idx] = trace
                } else {
                    session.traces.push(trace)
                }
                if (trace.endTime > session.endTime) session.endTime = trace.endTime
                this.broadcast({ type: "session_list", data: this.sessions })
            },
            onTraceProgress: (trace: Trace) => {
                this.broadcast({ type: "trace_progress", data: trace })
            },
            onSessionComplete: (session: Session) => {
                // 替换而非追加（onTraceComplete 可能已创建）
                const idx = this.sessions.findIndex(s => s.id === session.id)
                if (idx >= 0) {
                    this.sessions[idx] = session
                } else {
                    this.sessions.push(session)
                }
                this.broadcast({ type: "session_list", data: this.sessions })
            },
        }
    }

    start(): void {
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url ?? "/", `http://localhost:${this.port}`)

            if (url.pathname === "/events") {
                return this.handleSSE(req, res)
            }
            if (url.pathname === "/api/sessions") {
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify(this.sessions))
                return
            }
            this.serveStatic(url.pathname, res)
        })

        server.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                console.error(`  Port ${this.port} is in use. Try a different port.`)
                process.exit(1)
            }
        })

        server.listen(this.port, () => {
            console.log(`\n  pi-trace → http://localhost:${this.port}\n`)
        })

        setTimeout(() => exec(`open http://localhost:${this.port}`), 300)
    }

    private handleSSE(req: IncomingMessage, res: ServerResponse): void {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        })

        for (const data of this.buffer) {
            res.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        if (this.sessions.length > 0) {
            res.write(`data: ${JSON.stringify({ type: "session_list", data: this.sessions })}\n\n`)
        }

        this.clients.add(res)
        req.on("close", () => this.clients.delete(res))
    }

    private broadcast(data: unknown): void {
        if ((data as any)?.type !== "session_list") {
            this.buffer.push(data)
        }
        const msg = `data: ${JSON.stringify(data)}\n\n`
        for (const c of this.clients) {
            c.write(msg)
        }
    }

    private serveStatic(pathname: string, res: ServerResponse): void {
        if (pathname === "/") pathname = "/index.html"
        const uiDir = join(__dirname, "..", "ui", "dist")
        const fp = join(uiDir, pathname)

        if (!fp.startsWith(uiDir)) {
            res.writeHead(403)
            res.end("Forbidden")
            return
        }

        if (!existsSync(fp)) {
            res.writeHead(404)
            res.end("Not found")
            return
        }

        const content = readFileSync(fp)
        res.writeHead(200, { "Content-Type": MIME[extname(fp)] ?? "application/octet-stream" })
        res.end(content)
    }
}
