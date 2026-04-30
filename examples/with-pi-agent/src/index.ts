import { registerFauxProvider, fauxAssistantMessage } from "@mariozechner/pi-ai";
import { Agent } from "@mariozechner/pi-agent-core";
import { Collector, computeStats } from "pi-trace";

const faux = registerFauxProvider();
faux.setResponses([fauxAssistantMessage("Hello world!")]);
const agent = new Agent({ initialState: { model: faux.getModel() } });

const collector = new Collector(agent, {
	adapters: [
		{ onEvent: (e) => console.log(e.type), onTraceComplete: (t) => console.log(computeStats(t)) },
	],
});

collector.start();
await agent.prompt("Hi");
collector.stop();
faux.unregister();
