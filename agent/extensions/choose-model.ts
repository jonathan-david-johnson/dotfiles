import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

// Resolve the skill's scripts/ dir robustly. The extension .ts may be symlinked
// into ~/.pi/agent/extensions/ away from the skill dir, so __dirname is not
// reliable. Try, in order: explicit env override, the real location of this
// file (following symlinks), __dirname, then the installed skill symlinks in
// both harnesses.
function scriptPath(name: string): string {
	const candidates: string[] = [];
	if (process.env.CHOOSE_MODEL_DIR) {
		candidates.push(path.join(process.env.CHOOSE_MODEL_DIR, "scripts", name));
	}
	try {
		const real = fs.realpathSync(__filename);
		candidates.push(path.join(path.dirname(real), "scripts", name));
	} catch {
		/* ignore */
	}
	candidates.push(path.join(__dirname, "scripts", name));
	candidates.push(path.join(os.homedir(), ".pi/agent/skills/choose-model/scripts", name));
	candidates.push(path.join(os.homedir(), ".claude/skills/choose-model/scripts", name));
	for (const c of candidates) {
		if (fs.existsSync(c)) return c;
	}
	return candidates[candidates.length - 1];
}

async function runHelper(args: string[], timeout = 60_000): Promise<string> {
	try {
		const { stdout, stderr } = await execFileAsync(scriptPath("choose_model.py"), args, {
			cwd: process.cwd(),
			timeout,
			maxBuffer: 10 * 1024 * 1024,
		});
		return stdout + (stderr ? `\n\nSTDERR:\n${stderr}` : "");
	} catch (err: any) {
		const stdout = err?.stdout ?? "";
		const stderr = err?.stderr ?? err?.message ?? String(err);
		return `${stdout}\n\nError running choose-model helper:\n${stderr}`;
	}
}

export default function chooseModelExtension(pi: ExtensionAPI) {
	pi.registerCommand("choose-model", {
		description: "Recommend the best model for a prompt",
		handler: async (args, ctx) => {
			const prompt = args.trim();
			if (!prompt) {
				ctx.ui.notify("Usage: /choose-model <prompt>", "warning");
				return;
			}
			const output = await runHelper(["choose", prompt]);
			pi.sendMessage({ customType: "choose-model", content: output, display: true });
		},
	});

	pi.registerCommand("choose-model-list", {
		description: "List models in the choose-model registry (with short names)",
		handler: async () => {
			const output = await runHelper(["list"]);
			pi.sendMessage({ customType: "choose-model", content: output, display: true });
		},
	});

	pi.registerCommand("choose-model-and-evaluate", {
		description: "Stage 2+3a: run models on a prompt, auto-score, write a session manifest (does NOT record). Usage: /choose-model-and-evaluate <model1,model2> :: <prompt>",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const sep = trimmed.indexOf("::");
			if (!trimmed || sep < 0) {
				ctx.ui.notify("Usage: /choose-model-and-evaluate <model1,model2> :: <prompt>", "warning");
				return;
			}
			const models = trimmed.slice(0, sep).trim();
			const prompt = trimmed.slice(sep + 2).trim();
			if (!models || !prompt) {
				ctx.ui.notify("Usage: /choose-model-and-evaluate <model1,model2> :: <prompt>", "warning");
				return;
			}
			const ok = await ctx.ui.confirm("choose-model run", `Run prompt against these models?\n${models}\n\nThis is the auto first pass only — it writes a session manifest, NOT the registry. Review, manually test the run clones, then /choose-model-record. For interactive y/n gating, run the script directly in a terminal.`);
			if (!ok) return;
			const output = await runHelper(["run", prompt, "--models", models, "--yes"], 60 * 60 * 1000);
			pi.sendMessage({ customType: "choose-model", content: output, display: true });
		},
	});

	pi.registerCommand("choose-model-record", {
		description: "Stage 4: write a finalized session manifest to the registry. Usage: /choose-model-record <path/to/session.json>",
		handler: async (args, ctx) => {
			const session = args.trim();
			if (!session) {
				ctx.ui.notify("Usage: /choose-model-record <path/to/session.json>", "warning");
				return;
			}
			const ok = await ctx.ui.confirm("choose-model record", `Write evaluations from this session to the registry?\n${session}`);
			if (!ok) return;
			const output = await runHelper(["record", session]);
			pi.sendMessage({ customType: "choose-model", content: output, display: true });
		},
	});
}
