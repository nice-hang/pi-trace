import { Type } from "@mariozechner/pi-ai"

export const bashTool = {
	name: "bash",
	label: "Bash",
	description: "Execute a shell command",
	parameters: Type.Object({ command: Type.String() }),
	async execute(_: any, { command }: any) {
		const { exec } = await import("node:child_process")
		const out = await new Promise<string>(r => exec(command, (e, o) => r(e ? e.message : o)))
		return { content: [{ type: "text" as const, text: out }], details: out }
	},
}

export const fetchTool = {
	name: "fetch",
	label: "Fetch",
	description: "Fetch a URL and return the response text",
	parameters: Type.Object({ url: Type.String() }),
	async execute(_: any, { url }: any) {
		const text = await (await globalThis.fetch(url)).text()
		const clipped = text.slice(0, 2000)
		return { content: [{ type: "text" as const, text: clipped }], details: clipped }
	},
}
