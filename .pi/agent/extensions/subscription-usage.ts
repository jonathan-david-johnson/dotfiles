// Subscription usage status line for pi's footer — NO brain emoji.
//
// Shows live rate-limit utilization for OAuth ("subscription") providers:
//   - anthropic   (Claude Pro/Max)   → api.anthropic.com/api/oauth/usage
//   - openai-codex (ChatGPT Plus/Pro) → chatgpt.com/backend-api/wham/usage
//
// Format:  "✳ 5h 8% (2h30m) · wk 17% (3d4h)" for Anthropic or "⬡ …" for
// OpenAI (+ model-scoped weekly when the Anthropic API returns it, e.g.
// "· opus 52% (…)").  Green <70%, yellow
// 70-89%, red 90%+ or on an Anthropic extra-usage/HTTP-400 failure. In
// ASCII-only terminals the provider marker falls back to "A" or "O".
//
// Per-token (API-key) providers and any non-OAuth model get pi's default
// footer — this extension clears its status key for them.
//
// Replaces pi-claude-subscription-connector's usage-status.ts (the 🧠 line).
// The connector's subscription-guard.ts is vendored separately as
// extensions/subscription-guard.ts so Claude plan-billing still works.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// "0-…" sorts before lettered status keys, so this renders first in the footer.
const STATUS_KEY = "0-subscription-usage";
const POLL_MIN_INTERVAL_MS = 30_000;
const IDLE_REFRESH_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;
const OVERAGE_HEADER = "anthropic-ratelimit-unified-overage-in-use";

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

const SUPPORTED_PROVIDERS = new Set(["anthropic", "openai-codex"]);

// There are no standard Unicode brand marks for either provider, so use close
// visual stand-ins in Unicode-capable terminals and reliable ASCII fallbacks.
// Set PI_STATUS_ASCII=1 when the terminal/font cannot render the glyphs.
const PROVIDER_MARKERS: Record<string, { glyph: string; fallback: string }> = {
	anthropic: { glyph: "✳", fallback: "A" },
	"openai-codex": { glyph: "⬡", fallback: "O" },
};

function supportsUnicodeStatus(): boolean {
	if (process.env.PI_STATUS_ASCII === "1" || process.env.TERM === "dumb") return false;
	const locale = [process.env.LC_ALL, process.env.LC_CTYPE, process.env.LANG].find(Boolean);
	return !locale || !/^(?:C|POSIX)(?:[.@].*)?$/i.test(locale);
}

export function providerMarker(provider: string): string {
	const marker = PROVIDER_MARKERS[provider];
	if (!marker) return "";
	return supportsUnicodeStatus() ? marker.glyph : marker.fallback;
}

// Anthropic's usage endpoint rate-limits hard (429). We share a 60s cache file
// with ~/.claude/hooks/pi-statusline.py and ~/Documents/bin/usage so the three
// tools don't each burn quota. The statusline writes only s/w/ts; we also write
// reset stamps (sr/wr) after a successful live fetch.
const CLAUDE_CACHE_PATH = join(
	process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
	".usage-cache.json",
);
const CLAUDE_CACHE_TTL_MS = 60_000;

// ============================================================================
// Pure formatting helpers
// ============================================================================

interface UsageWindow {
	label: string;
	percent: number;
	/** Pre-rendered reset suffix, e.g. " (2h30m)", or "" when unknown. */
	reset: string;
}

type Severity = "ok" | "warn" | "critical";

const SEVERITY_COLOR: Record<Severity, string> = {
	ok: "success",
	warn: "warning",
	critical: "error",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPercent(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

/** Compact time remaining: "47m", "3h58m", "4d 2h", or "due". */
export function duration(seconds: number): string {
	seconds = Math.trunc(seconds);
	if (seconds <= 0) return "due";
	const days = Math.floor(seconds / 86_400);
	let rest = seconds - days * 86_400;
	const hours = Math.floor(rest / 3_600);
	rest -= hours * 3_600;
	const minutes = Math.floor(rest / 60);
	if (days) return `${days}d ${hours}h`;
	if (hours) return `${hours}h${String(minutes).padStart(2, "0")}m`;
	return `${minutes}m`;
}

/**
 * Render a window's reset as time remaining, from whichever field the API
 * supplies. Codex sends reset_after_seconds (+ reset_at epoch); Anthropic
 * sends an ISO resets_at / reset_at. Missing → "".
 */
export function resetSuffix(window: Record<string, unknown>): string {
	let seconds: number | undefined;
	const afterSeconds = window.reset_after_seconds;
	if (typeof afterSeconds === "number" && Number.isFinite(afterSeconds)) {
		seconds = afterSeconds;
	} else {
		const stamp = window.reset_at ?? window.resets_at;
		const nowSec = Date.now() / 1000;
		if (typeof stamp === "number" && Number.isFinite(stamp)) {
			seconds = stamp - nowSec;
		} else if (typeof stamp === "string") {
			const when = Date.parse(stamp);
			if (!Number.isNaN(when)) seconds = when / 1000 - nowSec;
		}
	}
	return seconds === undefined ? "" : ` (${duration(seconds)})`;
}

/** Parse Anthropic's /api/oauth/usage into display windows (with resets). */
export function parseAnthropicUsage(json: unknown): UsageWindow[] {
	if (!isRecord(json)) return [];

	// Reset timestamps for the session / weekly-all windows live on the
	// top-level blocks; limits[] entries may omit them, so backfill by kind.
	const topReset: Record<string, string> = {
		session: isRecord(json.five_hour) ? resetSuffix(json.five_hour) : "",
		weekly_all: isRecord(json.seven_day) ? resetSuffix(json.seven_day) : "",
	};
	const kindLabels: Record<string, string> = { session: "5h", weekly_all: "wk" };

	const limits = json.limits;
	if (Array.isArray(limits)) {
		const windows: UsageWindow[] = [];
		for (const entry of limits) {
			if (!isRecord(entry)) continue;
			const percent = asPercent(entry.percent);
			if (percent === undefined) continue;
			const kind = typeof entry.kind === "string" ? entry.kind : "";
			let label = kindLabels[kind];
			if (!label && kind === "weekly_scoped") {
				const scope = isRecord(entry.scope) ? entry.scope : undefined;
				const model = scope && isRecord(scope.model) ? scope.model : undefined;
				const name = model && typeof model.display_name === "string" ? model.display_name : "";
				label = name ? name.toLowerCase() : "model wk";
			}
			const reset = resetSuffix(entry) || topReset[kind] || "";
			windows.push({ label: label || kind || "limit", percent, reset });
		}
		if (windows.length > 0) return windows;
	}

	// Fallback: top-level utilization blocks.
	const windows: UsageWindow[] = [];
	const fallbacks: Array<[key: string, label: string]> = [
		["five_hour", "5h"],
		["seven_day", "wk"],
		["seven_day_opus", "opus"],
		["seven_day_sonnet", "sonnet"],
	];
	for (const [key, label] of fallbacks) {
		const block = json[key];
		if (!isRecord(block)) continue;
		const percent = asPercent(block.utilization);
		if (percent !== undefined) windows.push({ label, percent, reset: resetSuffix(block) });
	}
	return windows;
}

/** Parse Codex's /backend-api/wham/usage into display windows (with resets). */
export function parseCodexUsage(json: unknown): UsageWindow[] {
	if (!isRecord(json)) return [];
	const rl = isRecord(json.rate_limit) ? json.rate_limit : undefined;
	if (!rl) return [];
	const windows: UsageWindow[] = [];
	for (const key of ["primary_window", "secondary_window"] as const) {
		const w = rl[key];
		if (!isRecord(w)) continue;
		const percent = asPercent(w.used_percent);
		if (percent === undefined) continue;
		const seconds = w.limit_window_seconds;
		const isSession = typeof seconds === "number" && seconds < 24 * 60 * 60;
		windows.push({ label: isSession ? "5h" : "wk", percent, reset: resetSuffix(w) });
	}
	return windows;
}

// ---------------------------------------------------------------------------
// Shared Claude usage cache (session + weekly only; no model-scoped window)
// ---------------------------------------------------------------------------

interface ClaudeCache {
	s?: number | null; // session utilization %
	w?: number | null; // weekly utilization %
	sr?: string | null; // session resets_at (ISO)
	wr?: string | null; // weekly resets_at (ISO)
	ts?: number; // epoch seconds
}

function readClaudeCache(): ClaudeCache | null {
	try {
		if (!existsSync(CLAUDE_CACHE_PATH)) return null;
		const record = JSON.parse(readFileSync(CLAUDE_CACHE_PATH, "utf-8"));
		if (isRecord(record) && typeof record.ts === "number") return record as ClaudeCache;
		return null;
	} catch {
		return null;
	}
}

function windowsFromCache(c: ClaudeCache): UsageWindow[] {
	const out: UsageWindow[] = [];
	if (typeof c.s === "number") {
		out.push({ label: "5h", percent: Math.round(c.s), reset: c.sr ? resetSuffix({ resets_at: c.sr }) : "" });
	}
	if (typeof c.w === "number") {
		out.push({ label: "wk", percent: Math.round(c.w), reset: c.wr ? resetSuffix({ resets_at: c.wr }) : "" });
	}
	return out;
}

/** Mirror ~/Documents/bin/usage's write_claude_cache so all three tools agree. */
function writeClaudeCache(json: unknown): void {
	if (!isRecord(json)) return;
	const five = isRecord(json.five_hour) ? json.five_hour : undefined;
	const seven = isRecord(json.seven_day) ? json.seven_day : undefined;
	const s = five && typeof five.utilization === "number" ? five.utilization : null;
	const w = seven && typeof seven.utilization === "number" ? seven.utilization : null;
	if (s === null && w === null) return;
	const record: ClaudeCache = {
		s,
		w,
		sr: five && typeof five.resets_at === "string" ? five.resets_at : null,
		wr: seven && typeof seven.resets_at === "string" ? seven.resets_at : null,
		ts: Date.now() / 1000,
	};
	try {
		const tmp = `${CLAUDE_CACHE_PATH}.tmp`;
		writeFileSync(tmp, JSON.stringify(record));
		renameSync(tmp, CLAUDE_CACHE_PATH);
	} catch {
		// cache is an optimization; never fail the session over it
	}
}

export function formatBody(windows: UsageWindow[]): string {
	if (windows.length === 0) return "usage n/a";
	return windows.map((w) => `${w.label} ${w.percent}%${w.reset}`).join(" · ");
}

export function severityOf(windows: UsageWindow[]): Severity {
	const max = windows.reduce((acc, w) => Math.max(acc, w.percent), 0);
	if (max >= 90) return "critical";
	if (max >= 70) return "warn";
	return "ok";
}

export interface StatusSnapshot {
	windows: UsageWindow[];
	/** Anthropic reported billing to extra usage instead of the plan. */
	alarm: boolean;
	/** OAuth token missing or rejected (401/403). */
	loginNeeded: boolean;
	/** Last usage fetch failed (network, HTTP error, or bad shape). */
	fetchFailed: boolean;
	/** Set while a provider request was rejected outright (Anthropic HTTP 400). */
	providerErrorStatus: number | undefined;
}

export function composeStatus(s: StatusSnapshot): { text: string; color: string } {
	if (s.loginNeeded) return { text: "login needed", color: "warning" };

	const connectorFailure = s.alarm || s.providerErrorStatus !== undefined;
	if (s.windows.length === 0 && !connectorFailure && !s.fetchFailed) {
		return { text: "…", color: "dim" }; // first fetch still in flight
	}

	let text = formatBody(s.windows);
	if (!s.alarm && s.providerErrorStatus !== undefined) text += ` ⚠ HTTP ${s.providerErrorStatus}`;
	if (s.alarm) text += " ⚠ extra usage";
	if (s.fetchFailed && s.windows.length > 0) text += " (stale)";

	const color = connectorFailure
		? "error"
		: s.fetchFailed && s.windows.length === 0
			? "warning"
			: SEVERITY_COLOR[severityOf(s.windows)];
	return { text, color };
}

function shouldPoll(lastPollMs: number | undefined, nowMs: number): boolean {
	return lastPollMs === undefined || nowMs - lastPollMs >= POLL_MIN_INTERVAL_MS;
}

// ============================================================================
// Extension wiring
// ============================================================================

interface StatusUi {
	setStatus(key: string, text: string | undefined): void;
	notify(message: string, type?: string): void;
	theme?: { fg(color: string, text: string): string };
}

interface StatusCtx {
	ui: StatusUi;
	model?: { provider: string } | undefined;
	modelRegistry: {
		isUsingOAuth(model: { provider: string }): boolean;
		getApiKeyForProvider(provider: string): Promise<string | undefined>;
	};
	hasUI?: boolean;
}

export default function subscriptionUsage(pi: ExtensionAPI) {
	// Per-provider usage cache so switching models doesn't blank the line.
	const windowsByProvider = new Map<string, UsageWindow[]>();
	const lastPollByProvider = new Map<string, number>();
	let alarm = false; // anthropic extra-usage billing
	let loginNeeded = false;
	let fetchFailed = false;
	let providerErrorStatus: number | undefined;
	let inFlight = false;
	let idleTimer: ReturnType<typeof setInterval> | undefined;

	const paint = (ui: StatusUi, color: string, text: string): string =>
		ui.theme ? ui.theme.fg(color, text) : text;

	function activeProvider(ctx: StatusCtx): string | undefined {
		const model = ctx.model;
		if (!model || !SUPPORTED_PROVIDERS.has(model.provider)) return undefined;
		if (!ctx.modelRegistry.isUsingOAuth(model)) return undefined;
		return model.provider;
	}

	async function getToken(ctx: StatusCtx, provider: string): Promise<string | undefined> {
		try {
			const token = await ctx.modelRegistry.getApiKeyForProvider(provider);
			if (token) return token;
		} catch {
			// fall through to auth.json
		}
		try {
			// Lazy import keeps the module (and its pure parsers) importable without
			// the pi runtime, e.g. for unit tests.
			const { getAgentDir } = await import("@earendil-works/pi-coding-agent");
			const authPath = join(getAgentDir(), "auth.json");
			if (!existsSync(authPath)) return undefined;
			const auth = JSON.parse(readFileSync(authPath, "utf-8"));
			const entry = auth?.[provider];
			return entry && typeof entry.access === "string" ? entry.access : undefined;
		} catch {
			return undefined;
		}
	}

	function render(ctx: StatusCtx): void {
		const provider = activeProvider(ctx);
		if (!provider) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		const snapshot: StatusSnapshot = {
			windows: windowsByProvider.get(provider) ?? [],
			alarm: provider === "anthropic" ? alarm : false,
			loginNeeded,
			fetchFailed,
			providerErrorStatus: provider === "anthropic" ? providerErrorStatus : undefined,
		};
		const { text, color } = composeStatus(snapshot);
		const marker = providerMarker(provider);
		ctx.ui.setStatus(STATUS_KEY, paint(ctx.ui, color, marker ? `${marker} ${text}` : text));
	}

	async function fetchUsage(provider: string, token: string): Promise<UsageWindow[] | undefined> {
		const url = provider === "anthropic" ? ANTHROPIC_USAGE_URL : CODEX_USAGE_URL;
		const headers: Record<string, string> =
			provider === "anthropic"
				? { authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20" }
				: {
						authorization: `Bearer ${token}`,
						accept: "application/json",
						origin: "https://chatgpt.com",
					};
		const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (response.status === 401 || response.status === 403) {
			loginNeeded = true;
			fetchFailed = false;
			return undefined;
		}
		if (!response.ok) {
			fetchFailed = true;
			return undefined;
		}
		const json = await response.json();
		const parsed =
			provider === "anthropic" ? parseAnthropicUsage(json) : parseCodexUsage(json);
		loginNeeded = false;
		fetchFailed = parsed.length === 0; // empty/unrecognized payload counts as failed
		// Share fresh Anthropic numbers with ~/.claude statusline + usage script.
		if (provider === "anthropic" && parsed.length > 0) writeClaudeCache(json);
		return parsed;
	}

	async function refresh(ctx: StatusCtx, force = false): Promise<void> {
		const provider = activeProvider(ctx);
		if (!provider) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		const now = Date.now();

		// Anthropic's usage endpoint rate-limits in short windows (429). The shared
		// ~/.claude cache (also written by the statusline hook and the usage script)
		// lets us show last-known numbers instead of "usage n/a", and lets us skip
		// the network entirely while the cache is fresh so we don't burn quota.
		if (provider === "anthropic") {
			const cache = readClaudeCache();
			const cacheFresh = !!cache && now - (cache.ts ?? 0) * 1000 <= CLAUDE_CACHE_TTL_MS;
			// Seed the display immediately when memory is empty (no model-scoped yet).
			if (!windowsByProvider.has(provider) && cache) {
				const seeded = windowsFromCache(cache);
				if (seeded.length > 0) {
					windowsByProvider.set(provider, seeded);
					fetchFailed = false;
				}
			}
			const shouldFetch = !inFlight && !cacheFresh && (force || shouldPoll(lastPollByProvider.get(provider), now));
			if (!shouldFetch) {
				if (windowsByProvider.has(provider)) fetchFailed = false;
				render(ctx);
				return;
			}
		} else if (inFlight || (!force && !shouldPoll(lastPollByProvider.get(provider), now))) {
			render(ctx);
			return;
		}

		inFlight = true;
		lastPollByProvider.set(provider, now);
		try {
			const token = await getToken(ctx, provider);
			if (!token) {
				loginNeeded = true;
				return;
			}
			const parsed = await fetchUsage(provider, token);
			// Keep last-known numbers when a refresh returns nothing usable (e.g. 429).
			if (parsed && (parsed.length > 0 || !windowsByProvider.has(provider))) {
				windowsByProvider.set(provider, parsed);
			}
			// Anthropic 429: salvage numbers from the shared cache so we never show
			// "usage n/a" when any recent data exists.
			if (provider === "anthropic" && fetchFailed && !(windowsByProvider.get(provider)?.length)) {
				const cache = readClaudeCache();
				const seeded = cache ? windowsFromCache(cache) : [];
				if (seeded.length > 0) windowsByProvider.set(provider, seeded);
			}
		} catch {
			fetchFailed = true; // never break the session on a usage blip
		} finally {
			inFlight = false;
			render(ctx);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		const statusCtx = ctx as unknown as StatusCtx;
		if (!statusCtx.hasUI) return;
		await refresh(statusCtx, true);
		if (idleTimer) clearInterval(idleTimer);
		idleTimer = setInterval(() => {
			void refresh(statusCtx, true);
		}, IDLE_REFRESH_MS);
		idleTimer.unref?.();
	});

	pi.on("model_select", async (event, ctx) => {
		const statusCtx = ctx as unknown as StatusCtx;
		const model = (event as { model?: { provider: string } }).model;
		// Reset anthropic-only failure flags when leaving anthropic.
		if (!model || model.provider !== "anthropic") {
			alarm = false;
			providerErrorStatus = undefined;
		}
		loginNeeded = false;
		fetchFailed = false;
		if (!model || !SUPPORTED_PROVIDERS.has(model.provider) || !statusCtx.modelRegistry.isUsingOAuth(model)) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		await refresh(statusCtx, true);
	});

	pi.on("after_provider_response", async (event, ctx) => {
		const statusCtx = ctx as unknown as StatusCtx;
		if (statusCtx.model?.provider !== "anthropic") return;
		if (!statusCtx.modelRegistry.isUsingOAuth(statusCtx.model)) return;

		const e = event as { status?: number; headers?: Record<string, string> };
		if (e.status === 401 || e.status === 403) {
			loginNeeded = true;
			render(statusCtx);
			return;
		}
		const nowBilling = e.headers?.[OVERAGE_HEADER] === "true";
		if (nowBilling && !alarm) {
			ctx.ui.notify(
				"Claude request was billed to EXTRA USAGE, not your subscription — the Claude Code spoof may be broken.",
				"warning",
			);
		}
		alarm = nowBilling;
		if (e.status === 400) {
			if (providerErrorStatus === undefined) {
				ctx.ui.notify(
					"Claude request failed (HTTP 400). If this repeats, subscription billing may be broken — see the usage status.",
					"error",
				);
			}
			providerErrorStatus = 400;
		} else if (e.status !== undefined && e.status < 400) {
			providerErrorStatus = undefined;
			loginNeeded = false;
		}
		await refresh(statusCtx);
	});

	pi.on("session_shutdown", async () => {
		if (idleTimer) clearInterval(idleTimer);
		idleTimer = undefined;
	});
}
