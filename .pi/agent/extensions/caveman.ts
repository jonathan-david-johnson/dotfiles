/**
 * /caveman — Terse Communication Mode Extension
 *
 * Toggle a terse/caveman communication style. When active, the assistant
 * responds with extreme brevity — short sentences, no fluff, no pleasantries,
 * just facts and actions.
 *
 * Usage:
 *   /caveman           → toggle terse mode on/off
 *   /caveman on        → explicitly enable
 *   /caveman off       → explicitly disable
 *   /caveman status    → show current mode
 *
 * Inspired by the Claude Code "caveman" plugin.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CUSTOM_TYPE = "caveman-mode";

interface CavemanState {
	enabled: boolean;
	timestamp: number;
}

const TERSE_INSTRUCTION = `

## Communication Style: Terse Mode

You are in TERSE MODE. Follow these rules:
- Use short, direct sentences. No fluff.
- No greetings, apologies, or pleasantries.
- No markdown formatting unless specifically needed for code.
- Answer in 1-2 sentences max unless the user asks for detail.
- Use imperative voice for actions: "Done.", "Fixed.", "Added X to Y."
- Omit reasoning unless the user asks for it.
- Code blocks are OK when showing code. Keep explanations outside code blocks minimal.
`;

function getState(ctx: { sessionManager: { getEntries(): Array<{ type: string; customType?: string; data?: unknown }> } }): boolean {
	const entries = ctx.sessionManager.getEntries();
	let latest: CavemanState | undefined;
	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
			const data = entry.data as CavemanState | undefined;
			if (data && typeof data.enabled === "boolean" && typeof data.timestamp === "number") {
				if (!latest || data.timestamp > latest.timestamp) {
					latest = data;
				}
			}
		}
	}
	return latest?.enabled ?? false;
}

function setState(enabled: boolean, pi: ExtensionAPI) {
	pi.appendEntry(CUSTOM_TYPE, { enabled, timestamp: Date.now() });
}

function updateStatus(enabled: boolean, ctx: { ui: { setStatus: (id: string, text: string | undefined) => void } }) {
	if (enabled) {
		ctx.ui.setStatus("caveman", "🗿 TERSE");
	} else {
		ctx.ui.setStatus("caveman", undefined);
	}
}

export default function (pi: ExtensionAPI) {
	// ── Inject terse instruction into system prompt ─────────────────────
	pi.on("before_agent_start", async (event, ctx) => {
		const enabled = getState(ctx);
		updateStatus(enabled, ctx);
		if (!enabled) return;

		return {
			systemPrompt: event.systemPrompt + TERSE_INSTRUCTION,
		};
	});

	// ── Restore status on session start ─────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		const enabled = getState(ctx);
		updateStatus(enabled, ctx);
	});

	// ── Clean up status on shutdown ─────────────────────────────────────
	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus("caveman", undefined);
	});

	// ── /caveman command ────────────────────────────────────────────────
	pi.registerCommand("caveman", {
		description: "Toggle terse/caveman communication mode (on|off|status)",
		handler: async (args, ctx) => {
			const current = getState(ctx);
			const arg = args.trim().toLowerCase();

			let next: boolean;
			if (arg === "on") {
				next = true;
			} else if (arg === "off") {
				next = false;
			} else if (arg === "status") {
				ctx.ui.notify(current ? "🗿 Terse mode: ON" : "Terse mode: OFF", "info");
				return;
			} else {
				// Toggle
				next = !current;
			}

			setState(next, pi);
			updateStatus(next, ctx);
			ctx.ui.notify(next ? "🗿 Terse mode ON" : "Terse mode OFF", next ? "success" : "info");
		},
	});
}
