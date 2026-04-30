// packages/pi-trace/src/tracer.ts
//
// createTracer — 用户的一行接入点
//
// 把 Collector（采集）和 TracerServer（展示）装在一起。
// 用户只需要 createTracer(agent).serve()。

import { type Agent } from "@mariozechner/pi-agent-core"
import { Collector } from "./collector.js"
import { TracerServer } from "./server.js"

export interface Tracer {
	serve(options?: { port?: number }): void
}

export function createTracer(agent: Agent): Tracer {
	// 立即创建 server 和 collector，这样 agent 一调用 prompt()
	// 事件就开始被采集。serve() 只是启动 web 服务器。
	const server = new TracerServer()
	const collector = new Collector(agent, {
		adapters: [server.getAdapter()],
	})
	collector.start()

	return {
		serve(options) {
			if (options?.port) server.setPort(options.port)
			server.start()
		},
	}
}
