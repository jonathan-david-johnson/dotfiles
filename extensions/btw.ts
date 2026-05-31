/**
 * /btw — Side Conversation Extension
 *
 * Ask questions in an isolated context that doesn't pollute your main
 * conversation. After getting the answer, choose what to do with it:
 *   - Summarize into main context
 *   - Add full answer to main context
 *   - Discard
 *
 * Usage:
 *   /btw how does async/await work in Rust?
 *   /btw-list                → show all stored side conversations
 *   /btw-clear               → clear all side conversations
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const CONTEXT_TYPE = "btw-context";
const CLEARED_TYPE = "btw-cleared";

interface BtwContext {
	type: "summary" | "full";
	question: string;
	answer: string;
	timestamp: number;
}

interface Message {
	role: string;
	content: Array<{ type: string; text?: string }>;
}

// ── Spawn pi subprocess for isolated Q&A ────────────────────────────

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}
	return { command: "pi", args };
}

async function askSideQuestion(modelId: string, question: string, signal?: AbortSignal): Promise<string> {
	const invocation = getPiInvocation([
		"--mode", "json",
		"-p",
		"--no-session",
		"--model", modelId,
		`Task: ${question}`,
	]);

	return new Promise((resolve, reject) => {
		const proc = spawn(invocation.command, invocation.args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let buffer = "";
		const messages: Message[] = [];
		let stderr = "";

		proc.stdout.on("data", (data: Buffer) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_end" && event.message) {
						messages.push(event.message as Message);
					}
				} catch {
					// Ignore non-JSON lines
				}
			}
		});

		proc.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer);
					if (event.type === "message_end" && event.message) {
						messages.push(event.message as Message);
					}
				} catch {
					// Ignore
				}
			}

			if (code !== 0) {
				reject(new Error(stderr.trim() || `Subprocess exited with code ${code}`));
				return;
			}

			// Find last assistant message text
			for (let i = messages.length - 1; i >= 0; i--) {
				const msg = messages[i];
				if (msg.role === "assistant") {
					for (const part of msg.content) {
						if (part.type === "text" && part.text) {
							resolve(part.text);
							return;
						}
					}
				}
			}
			reject(new Error("No assistant response received"));
		});

		proc.on("error", (err) => reject(err));

		if (signal) {
			const kill = () => {
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 5000);
			};
			if (signal.aborted) kill();
			else signal.addEventListener("abort", kill, { once: true });
		}
	});
}

// ── Session helpers ─────────────────────────────────────────────────

function getActiveContexts(ctx: { sessionManager: { getEntries(): Array<{ type: string; customType?: string; data?: unknown }> } }): BtwContext[] {
	const entries = ctx.sessionManager.getEntries();

	let lastClearTime = 0;
	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === CLEARED_TYPE) {
			const data = entry.data as { timestamp?: number } | undefined;
			if (data?.timestamp && data.timestamp > lastClearTime) {
				lastClearTime = data.timestamp;
			}
		}
	}

	const contexts: BtwContext[] = [];
	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === CONTEXT_TYPE) {
			const data = entry.data as BtwContext | undefined;
			if (data?.timestamp && data.timestamp > lastClearTime && data.question && data.answer) {
				contexts.push(data);
			}
		}
	}
	return contexts;
}

function formatContextsSection(contexts: BtwContext[]): string {
	if (contexts.length === 0) return "";
	const lines = contexts.map((c, i) => {
		const label = c.type === "summary" ? "Summary" : "Full";
		const preview = c.answer.length > 400 ? c.answer.slice(0, 400) + "..." : c.answer;
		return `${i + 1}. [${label}] Q: ${c.question}\n   A: ${preview}`;
	});
	return `\n\n## Side Conversations (/btw)\n\n${lines.join("\n\n")}`;
}

function updateStatus(ctx: { ui: { setStatus: (id: string, text: string | undefined) => void } }, count: number) {
	if (count > 0) {
		ctx.ui.setStatus("btw", `📎 ${count} side Q&A`);
	} else {
		ctx.ui.setStatus("btw", undefined);
	}
}

// ── Main extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Intercept /btw <question> ──────────────────────────────────
	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" };

		const text = event.text.trim();
		if (!text.startsWith("/btw ")) return { action: "continue" };

		const question = text.slice(5).trim();
		if (!question) {
			ctx.ui.notify("Usage: /btw <question>", "warning");
			return { action: "handled" };
		}

		const model = ctx.model;
		if (!model) {
			ctx.ui.notify("No model selected. Select a model first.", "error");
			return { action: "handled" };
		}

		ctx.ui.setStatus("btw-conv", "💭 Side question...");

		try {
			const answer = await askSideQuestion(model.id, question, ctx.signal);

			// Show answer in widget (truncate for display)
			const displayLines = answer.split("\n").slice(0, 25);
			if (displayLines.length < answer.split("\n").length) {
				displayLines.push("... (truncated for display)");
			}
			ctx.ui.setWidget("btw-answer", [
				"══════ 📎 Side Question ══════",
				`Q: ${question}`,
				"",
				"A:",
				...displayLines,
				"",
				"═══════════════════════════════",
			]);

			// Ask what to do
			const choice = await ctx.ui.select("What to do with this answer?", [
				{ value: "summarize", label: "✂️ Summarize into context" },
				{ value: "full", label: "📋 Add full answer to context" },
				{ value: "discard", label: "🗑️ Discard" },
			]);

			if (choice === "summarize") {
				ctx.ui.setStatus("btw-conv", "✂️ Summarizing...");
				ctx.ui.setWidget("btw-answer", [
					"══════ 📎 Summarizing... ══════",
					"",
					"(making another call to summarize the answer)",
					"",
					"═══════════════════════════════",
				]);

				const summary = await askSideQuestion(
					model.id,
					`In 2-3 sentences, summarize the key points from this answer. Be extremely concise:\n\n${answer}`,
					ctx.signal,
				);

				pi.appendEntry(CONTEXT_TYPE, {
					type: "summary",
					question,
					answer: summary,
					timestamp: Date.now(),
				});

				const contexts = getActiveContexts(ctx);
				updateStatus(ctx, contexts.length);
				ctx.ui.notify(`Summary added (#${contexts.length})`, "success");

			} else if (choice === "full") {
				pi.appendEntry(CONTEXT_TYPE, {
					type: "full",
					question,
					answer,
					timestamp: Date.now(),
				});

				const contexts = getActiveContexts(ctx);
				updateStatus(ctx, contexts.length);
				ctx.ui.notify(`Full answer added (#${contexts.length})`, "success");

			} else {
				ctx.ui.notify("Discarded", "info");
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			ctx.ui.notify(`Side question failed: ${msg}`, "error");
		} finally {
			ctx.ui.setStatus("btw-conv", undefined);
			ctx.ui.setWidget("btw-answer", undefined);
		}

		return { action: "handled" };
	});

	// ── Inject side conversations into system prompt ───────────────
	pi.on("before_agent_start", async (event, ctx) => {
		const contexts = getActiveContexts(ctx);
		updateStatus(ctx, contexts.length);
		if (contexts.length === 0) return;

		return {
			systemPrompt: event.systemPrompt + formatContextsSection(contexts),
		};
	});

	// ── Restore status on session start ─────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		const contexts = getActiveContexts(ctx);
		updateStatus(ctx, contexts.length);
	});

	// ── Clean up on shutdown ────────────────────────────────────────
	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus("btw", undefined);
		ctx.ui.setStatus("btw-conv", undefined);
		ctx.ui.setWidget("btw-answer", undefined);
	});

	// ── /btw-list ───────────────────────────────────────────────────
	pi.registerCommand("btw-list", {
		description: "Show all stored side conversations",
		handler: async (_args, ctx) => {
			const contexts = getActiveContexts(ctx);
			if (contexts.length === 0) {
				ctx.ui.notify("No side conversations stored", "info");
				return;
			}
			const lines = contexts.map((c, i) => {
				const label = c.type === "summary" ? "[Summary]" : "[Full]";
				return `${i + 1}. ${label} Q: ${c.question}`;
			});
			ctx.ui.notify(`📎 ${contexts.length} side conversation(s):\n${lines.join("\n")}`, "info");
		},
	});

	// ── /btw-clear ──────────────────────────────────────────────────
	pi.registerCommand("btw-clear", {
		description: "Clear all side conversations",
		handler: async (_args, ctx) => {
			const contexts = getActiveContexts(ctx);
			if (contexts.length === 0) {
				ctx.ui.notify("No side conversations to clear", "info");
				return;
			}
			pi.appendEntry(CLEARED_TYPE, { timestamp: Date.now() });
			updateStatus(ctx, 0);
			ctx.ui.notify(`Cleared ${contexts.length} side conversation(s)`, "success");
		},
	});
}
