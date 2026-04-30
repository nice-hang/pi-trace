/**
 * pi-trace basic example
 *
 * 演示 createTracer 的最小接入方式。
 * 运行后打开 http://localhost:3333 查看实时事件流。
 */

import { registerFauxProvider, fauxAssistantMessage } from "@mariozechner/pi-ai"
import { Agent } from "@mariozechner/pi-agent-core"
import { createTracer } from "pi-trace"

// 1. 创建假 LLM（不需要真实 API key）
const faux = registerFauxProvider()
faux.setResponses([
	fauxAssistantMessage("The capital of France is Paris."),
])

const agent = new Agent({ initialState: { model: faux.getModel() } })

// 2. 一行接入 pi-trace（collector 自动开始采集）
const tracer = createTracer(agent)

// 3. 运行 agent
await agent.prompt("What is the capital of France?")

// 4. 启动 Web 调试界面（自动打开浏览器）
tracer.serve()

faux.unregister()
