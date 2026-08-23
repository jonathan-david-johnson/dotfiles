import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai/compat";
import {
	Container,
	Key,
	matchesKey,
	type SelectItem,
	SelectList,
	Text,
} from "@earendil-works/pi-tui";

type Level = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

const CANONICAL: Level[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const THINK_COLOR: Record<Level, string> = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
	max: "thinkingMax",
};

/** Levels a given model supports, in canonical order. Falls back to ["off"]. */
function levelsFor(model: any): Level[] {
	try {
		const levels = getSupportedThinkingLevels(model) as Level[];
		if (Array.isArray(levels) && levels.length > 0) {
			return CANONICAL.filter((l) => levels.includes(l));
		}
	} catch {
		/* ignore */
	}
	return ["off"];
}

/** Clamp a desired level to the nearest supported level (prefers <= desired). */
function clampLevel(desired: Level, supported: Level[]): Level {
	if (supported.includes(desired)) return desired;
	const rank = CANONICAL.indexOf(desired);
	let best: Level | undefined;
	for (const l of supported) {
		if (CANONICAL.indexOf(l) <= rank) best = l;
	}
	return best ?? supported[0] ?? "off";
}

export default function modelThinkingPicker(pi: ExtensionAPI) {
	// A clone of the built-in /model picker (same list: modelRegistry.getAvailable),
	// with Left/Right to change the thinking (reasoning effort) level.
	async function openPicker(ctx: ExtensionContext) {
		if (ctx.mode !== "tui" || !ctx.hasUI) return;

		const models = ctx.modelRegistry.getAvailable();
		if (models.length === 0) {
			ctx.ui.notify("No models with configured auth are available.", "warning");
			return;
		}

		const sorted = [...models].sort((a, b) =>
			a.provider === b.provider ? a.id.localeCompare(b.id) : a.provider.localeCompare(b.provider),
		);
		const byValue = new Map<string, any>();
		const currentValue = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;

		const items: SelectItem[] = sorted.map((m) => {
			const value = `${m.provider}/${m.id}`;
			byValue.set(value, m);
			const marker = value === currentValue ? "● " : "  ";
			return { value, label: `${marker}${value}`, description: m.name };
		});

		let desiredLevel: Level = (ctx.thinkingLevel as Level) ?? "off";

		const result = await ctx.ui.custom<{ value: string; level: Level } | null>(
			(tui, theme, _kb, done) => {
				const container = new Container();
				const border = () => new DynamicBorder((s: string) => theme.fg("accent", s));

				const title = new Text(theme.fg("accent", theme.bold("Select model")), 1, 0);
				const status = new Text("", 1, 0);
				const help = new Text(
					theme.fg("dim", "↑↓ model  •  ←→ thinking  •  type to filter  •  enter apply  •  esc cancel"),
					1,
					0,
				);

				const list = new SelectList(items, Math.min(items.length, 12), {
					selectedPrefix: (t) => theme.fg("accent", t),
					selectedText: (t) => theme.fg("accent", t),
					description: (t) => theme.fg("muted", t),
					scrollInfo: (t) => theme.fg("dim", t),
					noMatch: (t) => theme.fg("warning", t),
				});

				if (currentValue) {
					const idx = items.findIndex((it) => it.value === currentValue);
					if (idx >= 0) list.setSelectedIndex(idx);
				}

				const currentModel = () => {
					const sel = list.getSelectedItem();
					return sel ? byValue.get(sel.value) : undefined;
				};

				function refreshStatus() {
					const model = currentModel();
					const supported = model ? levelsFor(model) : ["off" as Level];
					const effective = clampLevel(desiredLevel, supported);
					const colored = supported
						.map((l) =>
							l === effective
								? theme.bg("selectedBg", theme.fg(THINK_COLOR[l], theme.bold(` ${l} `)))
								: theme.fg("dim", ` ${l} `),
						)
						.join("");
					status.setText(theme.fg("muted", "thinking: ") + colored);
				}

				function stepLevel(delta: number) {
					const model = currentModel();
					const supported = model ? levelsFor(model) : ["off" as Level];
					const effective = clampLevel(desiredLevel, supported);
					const i = supported.indexOf(effective);
					const next = supported[Math.min(supported.length - 1, Math.max(0, i + delta))];
					if (next) desiredLevel = next;
					refreshStatus();
					tui.requestRender();
				}

				list.onSelectionChange = () => {
					refreshStatus();
					tui.requestRender();
				};
				list.onSelect = (item) => {
					const model = byValue.get(item.value);
					const supported = model ? levelsFor(model) : ["off" as Level];
					done({ value: item.value, level: clampLevel(desiredLevel, supported) });
				};
				list.onCancel = () => done(null);

				container.addChild(border());
				container.addChild(title);
				container.addChild(status);
				container.addChild(list);
				container.addChild(help);
				container.addChild(border());

				refreshStatus();

				let filter = "";
				return {
					render: (w) => container.render(w),
					invalidate: () => {
						container.invalidate();
						refreshStatus();
					},
					handleInput: (data) => {
						if (matchesKey(data, Key.left)) {
							stepLevel(-1);
							return;
						}
						if (matchesKey(data, Key.right)) {
							stepLevel(1);
							return;
						}
						if (matchesKey(data, Key.backspace)) {
							if (filter.length > 0) {
								filter = filter.slice(0, -1);
								list.setFilter(filter);
								refreshStatus();
								tui.requestRender();
							}
							return;
						}
						if (data.length === 1 && data.charCodeAt(0) >= 32) {
							filter += data;
							list.setFilter(filter);
							refreshStatus();
							tui.requestRender();
							return;
						}
						list.handleInput(data);
						tui.requestRender();
					},
				};
			},
		);

		if (!result) return;

		const model = byValue.get(result.value);
		if (!model) return;

		const ok = await pi.setModel(model);
		if (!ok) {
			ctx.ui.notify(`No API key available for ${result.value}`, "error");
			return;
		}
		pi.setThinkingLevel(result.level);
		ctx.ui.notify(`Model: ${result.value}  •  thinking: ${result.level}`, "info");
	}

	// Replace the built-in model selector keybinding (Ctrl+L). The editor checks
	// extension shortcuts before built-in actions, so this takes precedence.
	pi.registerShortcut("ctrl+l", {
		description: "Model + thinking level picker",
		handler: openPicker,
	});

	pi.registerCommand("mm", {
		description: "Pick a model and thinking level (←/→ changes thinking)",
		handler: async (_args, ctx) => {
			await openPicker(ctx);
		},
	});
}
