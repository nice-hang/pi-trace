// packages/pi-trace/src/server.ts
//
// TracerServer — 本地 HTTP + SSE 服务器
//
// 只用 Node http 模块，不引入 Express。
// 两个端点（SSE + 静态文件）不值得一个框架。

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { join, extname } from "node:path"
import { fileURLToPath } from "node:url"
import { exec } from "node:child_process"
import type { TraceAdapter } from "./collector.js"
import type { Trace } from "./types.js"
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

	constructor(options?: { port?: number }) {
		this.port = options?.port ?? 3333
	}

	setPort(port: number): void {
		this.port = port
	}

	/** 返回 TraceAdapter，喂给 Collector */
	getAdapter(): TraceAdapter {
		return {
			onEvent: (event: AgentEvent) => {
				this.broadcast({ type: "event", data: event })
			},
			onTraceComplete: (trace: Trace) => {
				this.broadcast({ type: "trace_complete", data: trace })
			},
		}
	}

	start(): void {
		const server = createServer((req: IncomingMessage, res: ServerResponse) => {
			const url = new URL(req.url ?? "/", `http://localhost:${this.port}`)

			if (url.pathname === "/events") {
				return this.handleSSE(req, res)
			}
			this.serveStatic(url.pathname, res)
		})

		server.listen(this.port, () => {
			console.log(`\n  pi-trace → http://localhost:${this.port}\n`)
		})

		// 打开浏览器（macOS 支持 open 命令）
		setTimeout(() => exec(`open http://localhost:${this.port}`), 300)
	}

	private handleSSE(req: IncomingMessage, res: ServerResponse): void {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			"Access-Control-Allow-Origin": "*",
		})

		this.clients.add(res)
		req.on("close", () => this.clients.delete(res))
	}

	private broadcast(data: unknown): void {
		const msg = `data: ${JSON.stringify(data)}\n\n`
		for (const c of this.clients) {
			c.write(msg)
		}
	}

	private serveStatic(pathname: string, res: ServerResponse): void {
		if (pathname === "/") pathname = "/index.html"
		// ui/dist 相对于 server.ts 的位置
		const uiDir = join(__dirname, "..", "ui", "dist")
		const fp = join(uiDir, pathname)

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
