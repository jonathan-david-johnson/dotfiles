/**
 * /clarity - Clear Communication Mode Extension
 *
 * Clear mode is enabled by default for every new session. Use /clarity off
 * to disable the supplemental communication instruction for the session.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CUSTOM_TYPE = "clarity-mode";
const DEFAULT_ENABLED = true;

interface ClarityState {
	enabled: boolean;
	timestamp: number;
}

const CLARITY_INSTRUCTION = `

## Communication style: Clear mode

- Lead with the answer, action, decision, or result.
- Be concise, direct, and specific. Omit greetings, filler, repeated context, and unnecessary apologies.
- Use plain language, short sentences, and active voice. Identify the actor when it is not obvious.
- Separate verified facts from assumptions, recommendations, and uncertainty.
- Default to a short response for routine status or completion updates. Expand when the user asks for detail or when a decision, risk, plan, or explanation requires it.
- Use structure when it improves scanability. Do not add headings or lists merely for decoration.
- When creating, substantially revising, or reviewing documentation, follow the documentation-style skill.
`;

function getState(ctx: { sessionManager: { getEntries(): Array<{ type: string; customType?: string; data?: unknown }> } }): boolean {
	const entries = ctx.sessionManager.getEntries();
	let latest: ClarityState | undefined;
	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
			const data = entry.data as ClarityState | undefined;
			if (data && typeof data.enabled === "boolean" && typeof data.timestamp === "number") {
				if (!latest || data.timestamp > latest.timestamp) latest = data;
			}
		}
	}
	return latest?.enabled ?? DEFAULT_ENABLED;
}

function setState(enabled: boolean, pi: ExtensionAPI) {
	pi.appendEntry(CUSTOM_TYPE, { enabled, timestamp: Date.now() });
}

function updateStatus(enabled: boolean, ctx: { ui: { setStatus: (id: string, text: string | undefined) => void } }) {
	ctx.ui.setStatus("clarity", enabled ? "CLEAR" : undefined);
}

async function handleCommand(args: string, pi: ExtensionAPI, ctx: ExtensionContext) {
	const current = getState(ctx);
	const arg = args.trim().toLowerCase();
	if (arg === "status") {
		ctx.ui.notify(current ? "Clear mode: ON" : "Clear mode: OFF", "info");
		return;
	}
	const next = arg === "on" ? true : arg === "off" ? false : !current;
	setState(next, pi);
	updateStatus(next, ctx);
	ctx.ui.notify(next ? "Clear mode ON" : "Clear mode OFF", next ? "success" : "info");
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event, ctx) => {
		const enabled = getState(ctx);
		updateStatus(enabled, ctx);
		if (!enabled) return;
		return { systemPrompt: event.systemPrompt + CLARITY_INSTRUCTION };
	});

	pi.on("session_start", async (_event, ctx) => updateStatus(getState(ctx), ctx));
	pi.on("session_shutdown", async (_event, ctx) => ctx.ui.setStatus("clarity", undefined));

	const command = {
		description: "Toggle clear communication mode (on|off|status)",
		handler: async (args: string, ctx: ExtensionContext) => handleCommand(args, pi, ctx),
	};
	pi.registerCommand("clarity", command);
	// Accept the user's stated spelling as a convenience alias.
	pi.registerCommand("claity", command);
}
