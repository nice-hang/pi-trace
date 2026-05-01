// packages/pi-trace/src/tracer.ts

import { type Agent } from "@mariozechner/pi-agent-core"
import { Collector } from "./collector.js"
import { TracerServer } from "./server.js"

export interface TracerOptions {
    sessionId?: string
    metadata?: Record<string, unknown>
    port?: number
}

export interface Tracer {
    serve(options?: { port?: number }): void
    sessionId: string
    newSession(): void
}

export function createTracer(agent: Agent, options?: TracerOptions): Tracer {
    const server = new TracerServer({ port: options?.port })
    const collector = new Collector(agent, {
        adapters: [server.getAdapter()],
        sessionId: options?.sessionId,
        metadata: options?.metadata,
    })
    collector.start()

    return {
        sessionId: options?.sessionId ?? collector.getSession()?.id ?? "",
        serve(opts) {
            if (opts?.port) server.setPort(opts.port)
            server.start()
        },
        newSession() {
            collector.stop()
            collector.start()
            return collector.getSession()?.id ?? ""
        },
    }
}
