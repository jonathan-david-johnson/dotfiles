import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ── Types ───────────────────────────────────────────────────

type SkillInfo = {
  name: string;
  description: string;
  location: string;
};

// ── Config ──────────────────────────────────────────────────

/** Skills that are always visible in the system prompt. */
const DEFAULT_ENABLED = ["firecrawl-scrape", "firecrawl-search"];

// ── State ───────────────────────────────────────────────────

let catalog: SkillInfo[] = [];
let enabledNames: Set<string> = new Set(DEFAULT_ENABLED);

// ── Helpers ─────────────────────────────────────────────────

/** Parse all <skill> blocks from the system prompt XML. */
function parseSkillsFromPrompt(prompt: string): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const regex =
    /<skill\s+name="([^"]+)"\s+description="([^"]*?)">[\s\S]*?<location>([^<]+)<\/location>[\s\S]*?<\/skill>/g;
  let m;
  while ((m = regex.exec(prompt)) !== null) {
    skills.push({ name: m[1], description: m[2], location: m[3] });
  }
  return skills;
}

/** Rebuild the <available_skills> block with only enabled skills. */
function filterPromptSkills(prompt: string, enabled: Set<string>): string {
  return prompt.replace(
    /<available_skills>[\s\S]*?<\/available_skills>/,
    (match) => {
      const skills = parseSkillsFromPrompt(match);
      const filtered = skills.filter((s) => enabled.has(s.name));
      const inner = filtered
        .map(
          (s) =>
            `  <skill name="${s.name}" description="${s.description}">\n` +
            `    <location>${s.location}</location>\n` +
            `  </skill>`
        )
        .join("\n");
      return `<available_skills>\n${inner}\n</available_skills>`;
    }
  );
}

/** Populate catalog from system prompt options or string. */
function ensureCatalog(
  skills?: Array<{ name: string; description: string; location?: string }>,
  prompt?: string
) {
  if (catalog.length > 0) return;

  if (skills) {
    for (const s of skills) {
      catalog.push({
        name: s.name,
        description: s.description,
        location: s.location ?? "",
      });
    }
  }

  if (catalog.length === 0 && prompt) {
    catalog = parseSkillsFromPrompt(prompt);
  }

  for (const name of DEFAULT_ENABLED) {
    if (catalog.find((c) => c.name === name)) {
      enabledNames.add(name);
    }
  }
}

/** Persist the enabled set into the session (restored on restart). */
function saveState(pi: ExtensionAPI) {
  pi.appendEntry("skill-manager-state", {
    enabledNames: Array.from(enabledNames),
  });
}

// ── Extension ───────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── Restore state on session start ────────────────────────
  pi.on("session_start", async (event, ctx) => {
    let lastState: string[] | undefined;
    for (const entry of ctx.sessionManager.getEntries()) {
      if (
        entry.type === "custom" &&
        entry.customType === "skill-manager-state"
      ) {
        const data = entry.data as { enabledNames?: string[] };
        if (data.enabledNames) {
          lastState = data.enabledNames;
        }
      }
    }

    if (lastState) {
      enabledNames = new Set(lastState);
    } else {
      enabledNames = new Set(DEFAULT_ENABLED);
    }

    if (ctx.mode === "tui") {
      ctx.ui.notify(
        `Skill manager: ${enabledNames.size} enabled, ${catalog.length - enabledNames.size} hidden`,
        "info"
      );
    }
  });

  // ── Filter system prompt on every turn ──────────────────
  pi.on("before_agent_start", async (event, _ctx) => {
    ensureCatalog(event.systemPromptOptions?.skills, event.systemPrompt);

    // Filter the system prompt to only include enabled skills
    const filtered = filterPromptSkills(event.systemPrompt, enabledNames);
    return { systemPrompt: filtered };
  });

  // ── Commands ────────────────────────────────────────────

  pi.registerCommand("skill-search", {
    description: "Search available skills by name or description",
    handler: async (args, ctx) => {
      ensureCatalog(
        ctx.getSystemPromptOptions?.().skills,
        ctx.getSystemPrompt?.()
      );
      const query = cleanArgs(args).toLowerCase();
      if (!query) {
        ctx.ui.notify("Usage: /skill-search <query>", "info");
        return;
      }
      const matches = catalog.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
      if (matches.length === 0) {
        ctx.ui.notify("No matching skills found", "info");
        return;
      }
      const lines = matches.map((s) => {
        const status = enabledNames.has(s.name) ? "✓" : " ";
        const desc =
          s.description.length > 100
            ? s.description.slice(0, 100) + "…"
            : s.description;
        return `[${status}] ${s.name} — ${desc}`;
      });
      ctx.ui.notify(
        `${matches.length} match(es):\n${lines.join("\n")}`,
        "info"
      );
    },
  });

  pi.registerCommand("skill-enable", {
    description: "Enable a skill by name (available on next turn)",
    handler: async (args, ctx) => {
      ensureCatalog(
        ctx.getSystemPromptOptions?.().skills,
        ctx.getSystemPrompt?.()
      );
      const name = cleanArgs(args);
      if (!name) {
        ctx.ui.notify("Usage: /skill-enable <skill-name>", "info");
        return;
      }
      if (!catalog.find((c) => c.name === name)) {
        ctx.ui.notify(
          `Skill '${name}' not found. Use /skill-list to see available skills.`,
          "error"
        );
        return;
      }
      enabledNames.add(name);
      saveState(pi);
      ctx.ui.notify(
        `✓ Enabled '${name}'. Will be available on your next message.`,
        "info"
      );
    },
  });

  pi.registerCommand("skill-disable", {
    description: "Disable a skill by name (hidden on next turn)",
    handler: async (args, ctx) => {
      ensureCatalog(
        ctx.getSystemPromptOptions?.().skills,
        ctx.getSystemPrompt?.()
      );
      const name = cleanArgs(args);
      if (!name) {
        ctx.ui.notify("Usage: /skill-disable <skill-name>", "info");
        return;
      }
      enabledNames.delete(name);
      saveState(pi);
      ctx.ui.notify(
        `✓ Disabled '${name}'. Will be hidden on your next message.`,
        "info"
      );
    },
  });

  pi.registerCommand("skill-list", {
    description: "List all skills with enabled/disabled status",
    handler: async (_args, ctx) => {
      ensureCatalog(
        ctx.getSystemPromptOptions?.().skills,
        ctx.getSystemPrompt?.()
      );
      const lines = catalog.map((s) => {
        const status = enabledNames.has(s.name) ? "✓" : " ";
        return `[${status}] ${s.name}`;
      });
      ctx.ui.notify(
        `${catalog.length} total, ${enabledNames.size} enabled:\n${lines.join("\n")}`,
        "info"
      );
    },
  });

  // ── Tools (for LLM-driven discovery) ────────────────────

  pi.registerTool({
    name: "search_skills",
    label: "Search Skills",
    description:
      "Search the full skill catalog by keyword. Returns matching skills with their current status (enabled or hidden).",
    promptSnippet: "Search for available skills by keyword",
    promptGuidelines: [
      "Use search_skills when the user asks what skills are available, which skill can do a specific task, or needs help finding a capability.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "Search query for skill name or description",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const query = params.query.toLowerCase();
      const matches = catalog.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
      const lines = matches.map((s) => {
        const status = enabledNames.has(s.name) ? "enabled" : "hidden";
        const desc =
          s.description.length > 120
            ? s.description.slice(0, 120) + "…"
            : s.description;
        return `- ${s.name} [${status}]: ${desc}`;
      });
      return {
        content: [
          {
            type: "text",
            text:
              lines.join("\n") ||
              `No skills matched "${params.query}".`,
          },
        ],
        details: { matches: matches.length, query: params.query },
      };
    },
  });

  pi.registerTool({
    name: "enable_skill",
    label: "Enable Skill",
    description:
      "Enable a skill by name so it appears in the system prompt and can be auto-invoked on the next turn.",
    promptSnippet: "Enable a hidden skill by name",
    promptGuidelines: [
      "Use enable_skill when the user wants to activate a skill that is currently hidden.",
      "After enabling, tell the user the skill will be available on their next message.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description: "Exact skill name to enable (e.g., firecrawl-deep-research)",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const skill = catalog.find((c) => c.name === params.name);
      if (!skill) {
        return {
          content: [
            {
              type: "text",
              text: `Skill '${params.name}' not found. Use search_skills to find the correct name.`,
            },
          ],
          isError: true,
        };
      }
      enabledNames.add(params.name);
      saveState(pi);
      return {
        content: [
          {
            type: "text",
            text: `Enabled '${params.name}'. It will be available in the system prompt on the next user message. The user can then invoke it naturally or with /skill:${params.name}.`,
          },
        ],
        details: { enabled: true, skillName: params.name },
      };
    },
  });

  pi.registerTool({
    name: "disable_skill",
    label: "Disable Skill",
    description: "Disable a skill by name so it is hidden from the system prompt.",
    promptSnippet: "Disable a skill by name",
    promptGuidelines: [
      "Use disable_skill when the user wants to hide a skill from the system prompt.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description: "Exact skill name to disable",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      enabledNames.delete(params.name);
      saveState(pi);
      return {
        content: [
          {
            type: "text",
            text: `Disabled '${params.name}'. It will be hidden from the system prompt on the next user message.`,
          },
        ],
        details: { disabled: true, skillName: params.name },
      };
    },
  });
}
