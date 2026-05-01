import "dotenv/config"
import { createInterface } from "node:readline/promises"
import { getModel } from "@mariozechner/pi-ai"
import { Agent } from "@mariozechner/pi-agent-core"
import { createTracer } from "pi-trace"
import { bashTool, fetchTool } from "./tools.js"

if (!process.env.LLM_API_KEY) {
	console.error("  [error] LLM_API_KEY not set"); process.exit(1)
}

const [provider, modelId] = (process.env.PI_MODEL ?? "deepseek:deepseek-v4-flash").split(":")

const agent = new Agent({
	initialState: {
		model: getModel(provider as any, modelId as any),
		systemPrompt: "You are a helpful assistant with bash and fetch tools.",
	},
	getApiKey: () => process.env.LLM_API_KEY!,
})
agent.state.tools = [bashTool, fetchTool]

const tracer = createTracer(agent)
tracer.serve()

console.log("\n  Interactive CLI (Ctrl+C to exit)\n")
const rl = createInterface({ input: process.stdin, output: process.stdout })
while(true) {
	const input = await rl.question("> ")
	if (!input) continue
	await agent.prompt(input)
	for (const msg of agent.state.messages) {
		if (msg.role === "assistant" && "content" in msg && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "text") console.log(`  ${block.text}`)
			}
		}
	}
}
