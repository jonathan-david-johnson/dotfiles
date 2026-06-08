import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { matchesKey, Key, parseKey, truncateToWidth } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";

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

/** Strip surrounding quotes from command args. */
function cleanArgs(args: string): string {
  return args.trim().replace(/^["']|["']$/g, "").trim();
}

/** Normalize a skill file location from system prompt/options. */
function normalizeLocation(location: string): string {
  if (!location) return "";
  const home = process.env.HOME ?? "";
  if (location === "~") return home;
  if (location.startsWith("~/")) return path.join(home, location.slice(2));
  return path.isAbsolute(location) ? location : path.resolve(location);
}

/** Scan skill directories on disk as a fallback and to resolve SKILL.md paths. */
function scanSkillDirectories(): SkillInfo[] {
  const home = process.env.HOME ?? "";
  // Match pi's preference order: ~/.pi/agent/skills wins over legacy ~/.agents/skills.
  const dirs = [
    path.join(home, ".pi", "agent", "skills"),
    path.join(home, ".agents", "skills"),
    path.join(home, ".pi", "skills"),
  ];

  const byName = new Map<string, SkillInfo>();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      try {
        const content = fs.readFileSync(skillMd, "utf-8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        if (!fmMatch) continue;
        const fm = fmMatch[1];
        const nameMatch = fm.match(/^name:\s*(.+)$/m);
        const descMatch = fm.match(/^description:\s*(.+)$/m);
        const name = nameMatch?.[1]?.trim();
        const description = descMatch?.[1]?.trim();
        if (name && description && !byName.has(name)) {
          byName.set(name, { name, description, location: skillMd });
        }
      } catch {
        // ignore unreadable
      }
    }
  }
  return Array.from(byName.values());
}

/** Fill missing/invalid catalog locations from disk. */
function hydrateCatalogLocations() {
  const diskByName = new Map(scanSkillDirectories().map((s) => [s.name, s]));
  catalog = catalog.map((skill) => {
    const normalized = normalizeLocation(skill.location);
    if (normalized && fs.existsSync(normalized)) {
      return { ...skill, location: normalized };
    }
    const disk = diskByName.get(skill.name);
    return disk
      ? {
          ...skill,
          description: skill.description || disk.description,
          location: disk.location,
        }
      : { ...skill, location: normalized };
  });
}

/** Populate catalog from system prompt options, string, or filesystem. */
function ensureCatalog(
  skills?: Array<{ name: string; description: string; location?: string }>,
  prompt?: string
) {
  if (catalog.length > 0) {
    hydrateCatalogLocations();
    return;
  }

  const byName = new Map<string, SkillInfo>();

  if (skills) {
    for (const s of skills) {
      byName.set(s.name, {
        name: s.name,
        description: s.description,
        location: normalizeLocation(s.location ?? ""),
      });
    }
  }

  if (prompt) {
    for (const s of parseSkillsFromPrompt(prompt)) {
      if (!byName.has(s.name)) {
        byName.set(s.name, { ...s, location: normalizeLocation(s.location) });
      }
    }
  }

  for (const s of scanSkillDirectories()) {
    const existing = byName.get(s.name);
    if (!existing) {
      byName.set(s.name, s);
    } else if (!existing.location || !fs.existsSync(existing.location)) {
      byName.set(s.name, {
        ...existing,
        description: existing.description || s.description,
        location: s.location,
      });
    }
  }

  catalog = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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
  // ── Restore state on session start / tree navigation ─────
  function restoreFromBranch(ctx: ExtensionContext) {
    let lastState: string[] | undefined;
    for (const entry of ctx.sessionManager.getBranch()) {
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
  }

  pi.on("session_start", async (_event, ctx) => {
    restoreFromBranch(ctx);
    if (ctx.mode === "tui") {
      ctx.ui.notify(
        `Skill manager: ${enabledNames.size} enabled`,
        "info"
      );
    }
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreFromBranch(ctx);
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
    description: "List all skills — / search • ↑↓ navigate • Enter toggle • → view • Esc close",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/skill-list requires TUI mode", "error");
        return;
      }

      ensureCatalog(
        ctx.getSystemPromptOptions?.().skills,
        ctx.getSystemPrompt?.()
      );

      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        let selected = 0;
        let mode: "list" | "detail" = "list";
        let detailContent = "";
        let detailSkill: SkillInfo | undefined;
        let detailScroll = 0;
        let searchMode = false;
        let searchQuery = "";
        const skillContentCache = new Map<string, string>();

        const LIST_VISIBLE = 12;

        function wrapText(text: string, width: number): string[] {
          const safeWidth = Math.max(1, width);
          const words = text.trim().split(/\s+/).filter(Boolean);
          const lines: string[] = [];
          let current = "";
          for (const word of words) {
            if (word.length > safeWidth) {
              if (current) {
                lines.push(current);
                current = "";
              }
              for (let i = 0; i < word.length; i += safeWidth) {
                lines.push(word.slice(i, i + safeWidth));
              }
            } else if (!current) {
              current = word;
            } else if (current.length + 1 + word.length > safeWidth) {
              lines.push(current);
              current = word;
            } else {
              current = `${current} ${word}`;
            }
          }
          if (current) {
            lines.push(current);
          }
          return lines;
        }

        function readSkillContent(skill: SkillInfo): string {
          const cacheKey = skill.location || skill.name;
          const cached = skillContentCache.get(cacheKey);
          if (cached !== undefined) return cached;
          if (!skill.location) {
            skillContentCache.set(cacheKey, "");
            return "";
          }
          try {
            const content = fs.readFileSync(skill.location, "utf-8");
            skillContentCache.set(cacheKey, content);
            return content;
          } catch {
            skillContentCache.set(cacheKey, "");
            return "";
          }
        }

        function filteredSkills(): SkillInfo[] {
          const q = searchQuery.trim().toLowerCase();
          if (!q) return catalog;
          return catalog.filter((skill) => {
            if (skill.name.toLowerCase().includes(q)) return true;
            return readSkillContent(skill).toLowerCase().includes(q);
          });
        }

        function selectedSkillFromList(): SkillInfo | undefined {
          const list = filteredSkills();
          if (list.length === 0) return undefined;
          selected = Math.min(Math.max(0, selected), list.length - 1);
          return list[selected];
        }

        function renderList(width: number): string[] {
          const header = [
            truncateToWidth(
              theme.fg(
                "accent",
                theme.bold(searchMode
                  ? `Search: /${searchQuery}`
                  : "Skills — / search • ↑↓ navigate • Enter toggle • → view/v • Esc close")
              ),
              width
            ),
            "",
          ];

          if (catalog.length === 0) {
            return [
              ...header,
              theme.fg("muted", "No skills found. Check ~/.pi/agent/skills or ~/.agents/skills."),
            ].map((line) => truncateToWidth(line, width));
          }

          const list = filteredSkills();

          if (list.length === 0) {
            return [
              ...header,
              theme.fg("muted", `No skills match /${searchQuery}`),
            ].map((line) => truncateToWidth(line, width));
          }

          selected = Math.min(Math.max(0, selected), list.length - 1);

          // Scroll window so selected item is always visible
          const maxStart = Math.max(0, list.length - LIST_VISIBLE);
          const windowStart = Math.min(Math.max(0, selected - Math.floor(LIST_VISIBLE / 2)), maxStart);
          const windowEnd = Math.min(list.length, windowStart + LIST_VISIBLE);
          const visibleSkills = list.slice(windowStart, windowEnd);

          const items = visibleSkills.map((skill, i) => {
            const actualIndex = windowStart + i;
            const prefix = actualIndex === selected ? "> " : "  ";
            const status = enabledNames.has(skill.name) ? "✓" : " ";
            return truncateToWidth(
              `${prefix}[${status}] ${skill.name}`,
              width
            );
          });

          const scrollInfo =
            list.length > LIST_VISIBLE || searchQuery.trim()
              ? [
                  truncateToWidth(
                    theme.fg(
                      "dim",
                      searchQuery.trim()
                        ? `  ${windowStart + 1}-${windowEnd} of ${list.length} matches for /${searchQuery}`
                        : `  ${windowStart + 1}-${windowEnd} of ${list.length}`
                    ),
                    width
                  ),
                ]
              : [];

          // Description area at bottom
          const selectedSkill = list[selected];
          const descLines = selectedSkill
            ? wrapText(selectedSkill.description, Math.max(1, width - 2))
            : [];
          const descArea = [
            "",
            truncateToWidth(theme.fg("dim", "─".repeat(width)), width),
            ...descLines
              .slice(0, 5)
              .map((line) => truncateToWidth(theme.fg("muted", `  ${line}`), width)),
          ];

          return [...header, ...items, ...scrollInfo, ...descArea];
        }

        function renderDetail(width: number): string[] {
          const lines = detailContent.split("\n").map((line) =>
            truncateToWidth(line, width)
          );
          const header = [
            theme.fg(
              "accent",
              theme.bold(truncateToWidth(`← Back  •  ${detailSkill?.name ?? "skill"}  •  ↑↓ scroll`, width))
            ),
            "",
          ];
          const footer = [
            "",
            theme.fg(
              "dim",
              `line ${detailScroll + 1}-${Math.min(detailScroll + 25, lines.length)} of ${lines.length}`
            ),
          ];
          const visible = lines.slice(detailScroll, detailScroll + 25);
          return [...header, ...visible, ...footer];
        }

        function render(width: number): string[] {
          if (mode === "list") {
            return renderList(width);
          } else {
            return renderDetail(width);
          }
        }

        function handleInput(data: string): void {
          const key = parseKey(data);

          if (mode === "list") {
            const list = filteredSkills();

            if (searchMode) {
              if (matchesKey(data, Key.up)) {
                selected = Math.max(0, selected - 1);
              } else if (matchesKey(data, Key.down)) {
                selected = Math.min(list.length - 1, selected + 1);
              } else if (matchesKey(data, Key.escape)) {
                searchMode = false;
                searchQuery = "";
                selected = 0;
              } else if (matchesKey(data, Key.enter)) {
                searchMode = false;
              } else if (matchesKey(data, Key.backspace)) {
                searchQuery = searchQuery.slice(0, -1);
                selected = 0;
              } else if (key === "space") {
                searchQuery += " ";
                selected = 0;
              } else if (key && key.length === 1) {
                searchQuery += key;
                selected = 0;
              }
              tui.requestRender();
              return;
            }

            if (matchesKey(data, Key.up)) {
              selected = Math.max(0, selected - 1);
            } else if (matchesKey(data, Key.down)) {
              selected = Math.min(list.length - 1, selected + 1);
            } else if (matchesKey(data, Key.slash) || key === "/") {
              searchMode = true;
              searchQuery = "";
              selected = 0;
            } else if (matchesKey(data, Key.enter)) {
              const skill = selectedSkillFromList();
              if (!skill) return;
              if (enabledNames.has(skill.name)) {
                enabledNames.delete(skill.name);
              } else {
                enabledNames.add(skill.name);
              }
              saveState(pi);
            } else if (matchesKey(data, Key.right) || key === "right" || key === "v") {
              const skill = selectedSkillFromList();
              if (!skill) return;
              detailSkill = skill;
              detailContent = readSkillContent(skill) || `Error: could not read ${skill.location || "SKILL.md"}`;
              detailScroll = 0;
              mode = "detail";
            } else if (matchesKey(data, Key.escape)) {
              if (searchQuery.trim()) {
                searchQuery = "";
                selected = 0;
              } else {
                done(undefined);
                return;
              }
            }
          } else if (mode === "detail") {
            if (matchesKey(data, Key.left) || key === "left" || key === "v" || matchesKey(data, Key.escape)) {
              mode = "list";
            } else if (matchesKey(data, Key.up)) {
              detailScroll = Math.max(0, detailScroll - 1);
            } else if (matchesKey(data, Key.down)) {
              const lines = detailContent.split("\n");
              const maxScroll = Math.max(0, lines.length - 25);
              detailScroll = Math.min(maxScroll, detailScroll + 1);
            }
          }
          tui.requestRender();
        }

        function invalidate(): void {
          // no-op
        }

        return { render, invalidate, handleInput };
      });
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
