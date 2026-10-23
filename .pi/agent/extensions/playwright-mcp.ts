/**
 * Playwright MCP bridge for pi.
 *
 * Spawns `@playwright/mcp` as a stdio MCP server and re-registers every tool it
 * exposes as a native pi tool, so the LLM can drive a real Chrome browser
 * (browser_navigate, browser_click, browser_snapshot, ...) for interactive job
 * boards that firecrawl can't handle (Workday/Greenhouse search forms, pagination).
 *
 * Shares the persistent Chrome profile with Claude Code via a symlink:
 *   ~/.pi/playwright-profile -> ~/.claude/playwright-profile
 * Logged-in sessions survive across pi and Claude sessions. Chrome locks the
 * user-data dir, so don't run both at the same time — if Claude is using it, pi's
 * boot fails and the tools are skipped with a clear notify (no session crash).
 *
 * The Chrome process is kept alive across /new, /resume, /reload, /fork by stashing
 * the client on globalThis; only session_shutdown with reason "quit" tears it down.
 *
 * Chrome binary: launches "Chrome Agent.app", a copy of Google Chrome with its own
 * bundle ID (com.jdj.chrome-agent), so AeroSpace can send agent windows to workspace 9
 * without touching your own Chrome. Build it with ~/.pi/scripts/rebuild-chrome-agent.sh
 * (re-run after Chrome updates). Falls back to the default Chrome if the copy is missing.
 *
 * Location: ~/.pi/agent/extensions/playwright-mcp.ts (global, hot-reloadable via /reload).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CLAUDE_PROFILE = path.join(os.homedir(), ".claude", "playwright-profile");
const PI_PROFILE = path.join(os.homedir(), ".pi", "playwright-profile");
const OUTPUT_DIR = path.join(os.homedir(), ".pi", "playwright-output");
const CHROME_AGENT_BIN = path.join(os.homedir(), "Applications", "Chrome Agent.app", "Contents", "MacOS", "Google Chrome");

// ---- MCP stdio JSON-RPC client ----

interface PendingReq {
	resolve: (value: any) => void;
	reject: (err: Error) => void;
	method: string;
}

class McpClient {
	readonly proc: ChildProcess;
	private nextId = 1;
	private pending = new Map<number, PendingReq>();
	private stderrBuf = "";
	alive = true;

	constructor(proc: ChildProcess) {
		this.proc = proc;
		const rl = createInterface({ input: proc.stdout as any });
		rl.on("line", (line) => this.onLine(line));
		proc.stderr?.on("data", (c: Buffer) => {
			this.stderrBuf += c.toString();
			if (this.stderrBuf.length > 8000) this.stderrBuf = this.stderrBuf.slice(-8000);
		});
		proc.on("close", (code) => {
			this.alive = false;
			const err = new Error(`playwright-mcp exited (code ${code})${this.stderrBuf ? `: ${this.stderrBuf.trim().slice(-1500)}` : ""}`);
			for (const p of this.pending.values()) p.reject(err);
			this.pending.clear();
		});
		proc.on("error", (e) => {
			this.alive = false;
			for (const p of this.pending.values()) p.reject(e);
			this.pending.clear();
		});
	}

	private onLine(line: string) {
		if (!line.trim()) return;
		let msg: any;
		try {
			msg = JSON.parse(line);
		} catch {
			return; // not JSON — ignore
		}
		// Response to a request we sent?
		if (msg && typeof msg.id === "number" && (msg.result !== undefined || msg.error)) {
			const p = this.pending.get(msg.id);
			if (p) {
				this.pending.delete(msg.id);
				if (msg.error) p.reject(new Error(msg.error?.message ?? "MCP error"));
				else p.resolve(msg.result);
			}
		}
		// Server-initiated notifications/requests are ignored.
	}

	request(method: string, params: any, timeoutMs = 120000): Promise<any> {
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			let timer: NodeJS.Timeout | undefined;
			const cleanup = () => {
				if (timer) clearTimeout(timer);
				this.pending.delete(id);
			};
			timer = setTimeout(() => {
				cleanup();
				reject(new Error(`MCP ${method} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve: (v) => { cleanup(); resolve(v); },
				reject: (e) => { cleanup(); reject(e); },
				method,
			});
			try {
				this.proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
			} catch (e) {
				cleanup();
				reject(e instanceof Error ? e : new Error(String(e)));
			}
		});
	}

	notify(method: string, params: any = {}) {
		try {
			this.proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
		} catch {
			/* ignore */
		}
	}

	async initialize() {
		await this.request("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "pi-playwright-mcp", version: "1.0.0" },
		}, 60000);
		this.notify("notifications/initialized", {});
	}

	listTools(): Promise<{ tools: any[] }> {
		return this.request("tools/list", {}, 60000);
	}

	callTool(name: string, args: any, timeoutMs = 300000): Promise<{ content: any[]; isError?: boolean; _meta?: any }> {
		return this.request("tools/call", { name, arguments: args }, timeoutMs);
	}

	close() {
		this.alive = false;
		try { this.proc.stdin?.end(); } catch {}
		try { this.proc.kill("SIGTERM"); } catch {}
	}

	getStderr() { return this.stderrBuf.trim(); }
}

// ---- global state (survives extension reloads across /new, /resume, ...) ----

interface PwGlobalState {
	client: McpClient | null;
	tools: any[] | null;
	booting: Promise<void> | null;
	status: "idle" | "booting" | "ready" | "error";
	error: string | null;
}

const G = globalThis as unknown as { __piPlaywright?: PwGlobalState };
function state(): PwGlobalState {
	if (!G.__piPlaywright) {
		G.__piPlaywright = { client: null, tools: null, booting: null, status: "idle", error: null };
	}
	return G.__piPlaywright;
}

// ---- extension ----

function ensureProfileSymlink(): string {
	// Prefer the symlinked profile under ~/.pi; fall back to the Claude dir directly.
	if (!existsSync(PI_PROFILE) && existsSync(CLAUDE_PROFILE)) {
		try { symlinkSync(CLAUDE_PROFILE, PI_PROFILE, "dir"); } catch { /* race or perm — fall through */ }
	}
	if (existsSync(PI_PROFILE)) return PI_PROFILE;
	if (existsSync(CLAUDE_PROFILE)) return CLAUDE_PROFILE;
	return PI_PROFILE; // let playwright-mcp create a fresh temp-ish profile here
}

function mapContent(parts: any[] | undefined): any[] {
	if (!Array.isArray(parts)) return [{ type: "text", text: "(no content)" }];
	return parts.map((p) => {
		if (p?.type === "text") return { type: "text", text: String(p.text ?? "") };
		if (p?.type === "image") return { type: "image", data: p.data, mimeType: p.mimeType ?? "image/png" };
		if (p?.type === "resource" && p.resource?.text) return { type: "text", text: String(p.resource.text) };
		return { type: "text", text: JSON.stringify(p) };
	});
}

export default function (pi: ExtensionAPI) {
	async function boot(ctx: { ui?: any }): Promise<void> {
		const s = state();
		if (s.booting) return s.booting;
		s.booting = (async () => {
			s.status = "booting";
			try {
				mkdirSync(OUTPUT_DIR, { recursive: true });
				const profileDir = ensureProfileSymlink();
				const args = [
					"--yes", "@playwright/mcp@latest",
					"--user-data-dir", profileDir,
					"--output-dir", OUTPUT_DIR,
					...(existsSync(CHROME_AGENT_BIN) ? ["--executable-path", CHROME_AGENT_BIN] : []),
				];
				const proc = spawn("npx", args, {
					stdio: ["pipe", "pipe", "pipe"],
					cwd: OUTPUT_DIR,
					env: { ...process.env, PLAYWRIGHT_MCP_OUTPUT_DIR: OUTPUT_DIR },
				});
				const client = new McpClient(proc);
				s.client = client;
				await client.initialize();
				const { tools } = await client.listTools();
				s.tools = tools ?? [];
				registerTools(pi, s);
				s.status = "ready";
				s.error = null;
				ctx.ui?.notify?.(`Playwright MCP ready: ${s.tools.length} tools`, "info");
				ctx.ui?.setStatus?.("pw", `playwright: ${s.tools.length} tools`);
			} catch (e) {
				s.status = "error";
				s.error = e instanceof Error ? e.message : String(e);
				const hint = /user data directory|profile|lock/i.test(s.error)
					? " (profile may be locked — is Claude Code using the same Chrome profile?)"
					: "";
				ctx.ui?.notify?.(`Playwright MCP failed to start: ${s.error}${hint}`, "error");
				// tear down a half-started client
				s.client?.close?.();
				s.client = null;
				throw e;
			} finally {
				s.booting = null;
			}
		})();
		return s.booting;
	}

	pi.on("session_start", async (_event, ctx) => {
		const s = state();
		if (s.status === "ready" && s.client?.alive) {
			// already running from a previous session in this process — just re-register tools
			if (s.tools && pi.getAllTools().every((t) => !t.name.startsWith("browser_"))) {
				registerTools(pi, s);
			}
			ctx.ui?.setStatus?.("pw", `playwright: ${s.tools?.length ?? 0} tools`);
			return;
		}
		if (s.status === "error") {
			// previous boot failed this process — don't auto-retry every session and spam.
			ctx.ui?.setStatus?.("pw", "playwright: off");
			return;
		}
		try {
			await boot(ctx);
		} catch {
			/* error already notified */
		}
	});

	pi.on("session_shutdown", async (event, _ctx) => {
		// Only tear down on real quit. /new, /resume, /reload, /fork keep Chrome alive.
		if (event.reason === "quit") {
			const s = state();
			s.client?.close?.();
			s.client = null;
			s.tools = null;
			s.status = "idle";
			s.error = null;
		}
	});

	// Status command
	pi.registerCommand("playwright", {
		description: "Show Playwright MCP bridge status (or restart)",
		handler: async (args, ctx) => {
			const s = state();
			if (args.trim() === "restart") {
				s.client?.close?.();
				s.client = null;
				s.tools = null;
				s.status = "idle";
				s.error = null;
				ctx.ui.notify("Restarting Playwright MCP…", "info");
				try {
					await boot(ctx);
				} catch {
					/* notified in boot */
				}
				return;
			}
			const alive = s.client?.alive ? "alive" : "down";
			ctx.ui.notify(
				`Playwright MCP: ${s.status} (${alive}) — ${s.tools?.length ?? 0} tools` +
				(s.error ? `\nerror: ${s.error}` : ""),
				s.status === "ready" ? "info" : s.status === "error" ? "error" : "info",
			);
		},
	});
}

function registerTools(pi: ExtensionAPI, s: PwGlobalState) {
	const client = s.client;
	if (!client || !s.tools) return;
	for (const t of s.tools) {
		const name = String(t.name);
		const description = String(t.description ?? `Playwright MCP tool: ${name}`);
		const inputSchema = t.inputSchema ?? { type: "object", properties: {}, additionalProperties: true };
		pi.registerTool({
			name,
			label: name.replace(/^browser_/, ""),
			description,
			parameters: inputSchema as any,
			promptGuidelines: [
				"Use browser_* tools (Playwright MCP) to drive a real Chrome browser for interactive job boards that static scrapers can't handle (Workday/Greenhouse search forms, pagination, login-gated pages). The browser shares a persistent profile, so logged-in sessions survive. Prefer browser_snapshot to read page state before clicking.",
			],
			async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
				if (!client.alive) throw new Error("Playwright MCP server is not running (use /playwright restart)");
				const callP = client.callTool(name, params);
				if (signal) {
					const onAbort = () => {
						// Can't truly cancel an in-flight MCP call, but unblock the caller.
						// The pending entry will resolve later and be dropped.
					};
					signal.addEventListener("abort", onAbort, { once: true });
					try {
						const result = await callP;
						return {
							content: mapContent(result.content),
							isError: !!result.isError,
							details: { _meta: result._meta },
						};
					} finally {
						signal.removeEventListener("abort", onAbort);
					}
				}
				const result = await callP;
				return {
					content: mapContent(result.content),
					isError: !!result.isError,
					details: { _meta: result._meta },
				};
			},
		});
	}
}
