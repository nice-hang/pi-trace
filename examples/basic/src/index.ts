/**
 * pi-tracing basic example
 *
 * 演示 createTracer 的最小接入方式。
 * 运行后打开 http://localhost:3333 查看实时事件流。
 */

import { registerFauxProvider, fauxAssistantMessage } from "@mariozechner/pi-ai"
import { Agent } from "@mariozechner/pi-agent-core"
import { createTracer } from "pi-tracing"

// 1. 创建假 LLM（不需要真实 API key）
const faux = registerFauxProvider()
faux.setResponses([
	fauxAssistantMessage("The capital of France is Paris."),
])

const agent = new Agent({ initialState: { model: faux.getModel() } })

// 2. 一行接入 pi-tracing（collector 自动开始采集）
const tracer = createTracer(agent)

// 3. 启动 Web 调试界面（自动打开浏览器）
// 必须先 serve()，这样 prompt() 时的事件才能实时推送到浏览器
tracer.serve()

// 4. 运行 agent — 打开浏览器看实时事件流
await agent.prompt("What is the capital of France?")

console.log("Done! Check the browser for event trace.")
faux.unregister()
