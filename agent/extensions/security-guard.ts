/**
 * Security Guard Extension
 *
 * Prompts for confirmation before destructive operations:
 * - Any file/directory deletion (rm, rmdir, unlink, shred, etc.)
 * - Any sudo command
 * - Truncating existing files (write with empty content)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";

export default function (pi: ExtensionAPI) {
	// Patterns that indicate file/directory deletion
	const deletionPatterns = [
		/\brm\b/i,
		/\brmdir\b/i,
		/\bunlink\b/i,
		/\bshred\b/i,
		/\btruncate\s+-s\s+0\b/i,
	];

	// Sudo pattern
	const sudoPattern = /\bsudo\b/i;

	pi.on("tool_call", async (event, ctx) => {
		// ── Bash tool: check for deletion or sudo ──
		if (event.toolName === "bash") {
			const command = (event.input.command as string) || "";

			const isDeletion = deletionPatterns.some((p) => p.test(command));
			const isSudo = sudoPattern.test(command);

			if (isDeletion || isSudo) {
				if (!ctx.hasUI) {
					return {
						block: true,
						reason: `Blocked ${isDeletion ? "destructive" : "sudo"} command (no UI for confirmation)`,
					};
				}

				const action = isDeletion
					? "Destructive command detected"
					: "Sudo command detected";

				const confirmed = await ctx.ui.confirm(
					`🔒 ${action}`,
					`Allow this command?\n\n  ${command}`,
				);

				if (!confirmed) {
					ctx.ui.notify("Blocked by user", "warning");
					return { block: true, reason: "Blocked by user" };
				}
			}
		}

		// ── Write tool: check for empty overwrite of existing file ──
		if (event.toolName === "write") {
			const path = (event.input.path as string) || "";
			const content = (event.input.content as string) ?? "";

			if (content === "" && existsSync(path)) {
				if (!ctx.hasUI) {
					return {
						block: true,
						reason: "Blocked empty overwrite of existing file (no UI for confirmation)",
					};
				}

				const confirmed = await ctx.ui.confirm(
					`🔒 Empty overwrite detected`,
					`This will erase the contents of:\n\n  ${path}\n\nAllow?`,
				);

				if (!confirmed) {
					ctx.ui.notify("Blocked by user", "warning");
					return { block: true, reason: "Blocked by user" };
				}
			}
		}

		return undefined;
	});
}
