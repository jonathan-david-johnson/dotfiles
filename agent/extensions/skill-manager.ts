import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { matchesKey, Key, parseKey, truncateToWidth } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
type SkillInfo = {
  name: string;
  description: string;
  location: string;
};

// Config – always enabled default skills
const DEFAULT_ENABLED = ["caveman", "context7", "firecrawl", "grill-me", "handoff", "html-doc", "youtube-transcript"];

// State
let catalog: SkillInfo[] = [];
let enabledNames: Set<string> = new Set(DEFAULT_ENABLED);

// Helpers
function parseSkillsFromPrompt(prompt: string): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const regex = /<skill\s+name="([^"]+)"\s+description="([^"]*?)">[\s\S]*?<location>([^<]+)<\/location>[\s\S]*?<\/skill>/g;
  let m;
  while ((m = regex.exec(prompt)) !== null) {
    skills.push({ name: m[1], description: m[2], location: m[3] });
  }
  return skills;
}
function xmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function renderSkillBlock(skills: SkillInfo[]): string {
  const inner = skills
    .map(
      (s) =>
        `  <skill name="${xmlAttr(s.name)}" description="${xmlAttr(s.description)}">\n` +
        `    <location>${s.location}</location>\n` +
        `  </skill>`
    )
    .join("\n");
  return `<available_skills>\n${inner}\n</available_skills>`;
}
// Rebuilds the block from the enabled set: removes disabled skills AND adds
// enabled skills pi's own loader never saw (disk-scanned catalog entries).
function filterPromptSkills(prompt: string, enabled: Set<string>): string {
  const byName = new Map<string, SkillInfo>();
  for (const s of parseSkillsFromPrompt(prompt)) {
    byName.set(s.name, { ...s, location: normalizeLocation(s.location) });
  }
  for (const s of catalog) {
    const existing = byName.get(s.name);
    if (!existing || !existing.location || !fs.existsSync(existing.location)) {
      if (s.location && fs.existsSync(s.location)) byName.set(s.name, s);
      else if (!existing) byName.set(s.name, s);
    }
  }
  const selected = Array.from(byName.values())
    .filter((s) => enabled.has(s.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const block = renderSkillBlock(selected);
  if (/<available_skills>[\s\S]*?<\/available_skills>/.test(prompt)) {
    return prompt.replace(/<available_skills>[\s\S]*?<\/available_skills>/, block);
  }
  if (selected.length === 0) return prompt;
  return `${prompt}\n\n${block}`;
}
function cleanArgs(args: string): string {
  return args.trim().replace(/^['"]|['"]$/g, "").trim();
}
function normalizeLocation(location: string): string {
  if (!location) return "";
  const home = process.env.HOME ?? "";
  if (location === "~") return home;
  if (location.startsWith("~/")) return path.join(home, location.slice(2));
  return path.isAbsolute(location) ? location : path.resolve(location);
}
function configDir(): string {
  const home = process.env.HOME ?? "";
  return process.env.PI_CODING_AGENT_DIR ?? path.join(home, ".pi", "agent");
}
function scanSkillDirectories(): SkillInfo[] {
  const home = process.env.HOME ?? "";
  const dirs = [
    path.join(configDir(), "skills"),
    path.join(home, ".agents", "skills"),
    path.join(process.cwd(), ".pi", "skills"),
    path.join(process.cwd(), ".agents", "skills"),
  ];
  const byName = new Map<string, SkillInfo>();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
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
      } catch {}
    }
  }
  return Array.from(byName.values());
}
function hydrateCatalogLocations() {
  const diskByName = new Map(scanSkillDirectories().map((s) => [s.name, s]));
  catalog = catalog.map((skill) => {
    const normalized = normalizeLocation(skill.location);
    if (normalized && fs.existsSync(normalized)) {
      return { ...skill, location: normalized };
    }
    const disk = diskByName.get(skill.name);
    return disk
      ? { ...skill, description: skill.description || disk.description, location: disk.location }
      : { ...skill, location: normalized };
  });
}
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
  catalog = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const name of DEFAULT_ENABLED) {
    if (catalog.find((c) => c.name === name)) {
      enabledNames.add(name);
    }
  }
}
function saveState(pi: ExtensionAPI) {
  pi.appendEntry("skill-manager-state", { enabledNames: Array.from(enabledNames) });
}

export default function (pi: ExtensionAPI) {
  function restoreFromBranch(ctx: ExtensionContext) {
    let lastState: string[] | undefined;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === "skill-manager-state") {
        const data = entry.data as { enabledNames?: string[] };
        if (data.enabledNames) lastState = data.enabledNames;
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
      ctx.ui.notify(`Skill manager: ${enabledNames.size} enabled`, "info");
    }
  });
  pi.on("session_tree", async (_event, ctx) => {
    restoreFromBranch(ctx);
  });
  pi.on("before_agent_start", async (event, _ctx) => {
    ensureCatalog(event.systemPromptOptions?.skills, event.systemPrompt);
    const filtered = filterPromptSkills(event.systemPrompt, enabledNames);
    return { systemPrompt: filtered };
  });

  // Only keep the skill-list command (the UI for browsing/toggling skills)
  pi.registerCommand("skill-list", {
    description: "List all skills — / search • ↑↓ navigate • Enter toggle • → view • Esc close",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/skill-list requires TUI mode", "error");
        return;
      }
      ensureCatalog(ctx.getSystemPromptOptions?.().skills, ctx.getSystemPrompt?.());
      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        let selected = 0;
        let mode: "list" | "detail" = "list";
        let detailContent = "";
        let detailSkill: SkillInfo | undefined;
        let detailScroll = 0;
        let searchMode = false;
        let searchQuery = "";
        const cache = new Map<string, string>();
        const LIST_VISIBLE = 12;
        const wrapText = (text: string, width: number) => {
          const w = Math.max(1, width);
          const words = text.trim().split(/\s+/).filter(Boolean);
          const lines: string[] = [];
          let cur = "";
          for (const word of words) {
            if (word.length > w) {
              if (cur) { lines.push(cur); cur = ""; }
              for (let i = 0; i < word.length; i += w) lines.push(word.slice(i, i + w));
            } else if (!cur) cur = word;
            else if (cur.length + 1 + word.length > w) { lines.push(cur); cur = word; }
            else cur = `${cur} ${word}`;
          }
          if (cur) lines.push(cur);
          return lines;
        };
        const readSkillContent = (skill: SkillInfo) => {
          const key = skill.location || skill.name;
          if (cache.has(key)) return cache.get(key)!;
          try { const c = fs.readFileSync(skill.location, "utf-8"); cache.set(key, c); return c; }
          catch { cache.set(key, ""); return ""; }
        };
        const filteredSkills = () => {
          const q = searchQuery.trim().toLowerCase();
          if (!q) return catalog;
          return catalog.filter((s) => s.name.toLowerCase().includes(q) || readSkillContent(s).toLowerCase().includes(q));
        };
        const selectedSkill = () => {
          const list = filteredSkills();
          selected = Math.min(Math.max(0, selected), list.length - 1);
          return list[selected];
        };
        const renderList = (width: number) => {
          const header = [
            truncateToWidth(
              theme.fg("accent", theme.bold(searchMode ? `Search: /${searchQuery}` : "Skills — / search • ↑↓ navigate • Enter toggle • → view/v • Esc close")),
              width
            ),
            "",
          ];
          const list = filteredSkills();
          const maxStart = Math.max(0, list.length - LIST_VISIBLE);
          const start = Math.min(Math.max(0, selected - Math.floor(LIST_VISIBLE / 2)), maxStart);
          const end = Math.min(list.length, start + LIST_VISIBLE);
          const items = list.slice(start, end).map((skill, i) => {
            const idx = start + i;
            const prefix = idx === selected ? "> " : "  ";
            const status = enabledNames.has(skill.name) ? "✓" : " ";
            return truncateToWidth(`${prefix}[${status}] ${skill.name}`, width);
          });
          const scrollInfo = (list.length > LIST_VISIBLE || searchQuery.trim()) ? [
            truncateToWidth(theme.fg("dim", `  ${start + 1}-${end} of ${list.length}${searchQuery.trim() ? ` matches for /${searchQuery}` : ""}`), width)
          ] : [];
          const sel = list[selected];
          const desc = sel ? wrapText(sel.description, Math.max(1, width - 2)) : [];
          const descArea = ["", truncateToWidth(theme.fg("dim", "─".repeat(width)), width), ...desc.slice(0,5).map(l=>truncateToWidth(theme.fg("muted", `  ${l}`), width))];
          return [...header, ...items, ...scrollInfo, ...descArea];
        };
        const renderDetail = (width: number) => {
          const lines = detailContent.split("\n").map(l=>truncateToWidth(l, width));
          const header = [
            theme.fg("accent", theme.bold(truncateToWidth(`← Back  •  ${detailSkill?.name ?? "skill"}  •  ↑↓ scroll`, width))),
            "",
          ];
          const footer = ["", theme.fg("dim", `line ${detailScroll + 1}-${Math.min(detailScroll + 25, lines.length)} of ${lines.length}`)];
          const visible = lines.slice(detailScroll, detailScroll + 25);
          return [...header, ...visible, ...footer];
        };
        const render = (width: number) => (mode === "list" ? renderList(width) : renderDetail(width));
        const handleInput = (data: string) => {
          const key = parseKey(data);
          if (mode === "list") {
            if (searchMode) {
              if (matchesKey(data, Key.up)) selected = Math.max(0, selected - 1);
              else if (matchesKey(data, Key.down)) selected = Math.min(filteredSkills().length - 1, selected + 1);
              else if (matchesKey(data, Key.escape)) { searchMode = false; searchQuery = ""; selected = 0; }
              else if (matchesKey(data, Key.enter)) searchMode = false;
              else if (matchesKey(data, Key.backspace)) { searchQuery = searchQuery.slice(0, -1); selected = 0; }
              else if (key && key.length === 1) { searchQuery += key; selected = 0; }
              else if (key === "space") { searchQuery += " "; selected = 0; }
              tui.requestRender();
              return;
            }
            if (matchesKey(data, Key.up)) selected = Math.max(0, selected - 1);
            else if (matchesKey(data, Key.down)) selected = Math.min(filteredSkills().length - 1, selected + 1);
            else if (matchesKey(data, Key.slash) || key === "/") { searchMode = true; searchQuery = ""; selected = 0; }
            else if (matchesKey(data, Key.enter)) {
              const skill = selectedSkill();
              if (!skill) return;
              if (enabledNames.has(skill.name)) enabledNames.delete(skill.name);
              else enabledNames.add(skill.name);
              saveState(pi);
            } else if (matchesKey(data, Key.right) || key === "right" || key === "v") {
              const skill = selectedSkill();
              if (!skill) return;
              detailSkill = skill;
              detailContent = readSkillContent(skill) || `Error: could not read ${skill.location || "SKILL.md"}`;
              detailScroll = 0;
              mode = "detail";
            } else if (matchesKey(data, Key.escape)) {
              if (searchQuery.trim()) { searchQuery = ""; selected = 0; }
              else { done(undefined); return; }
            }
          } else {
            if (matchesKey(data, Key.left) || key === "left" || key === "v" || matchesKey(data, Key.escape)) mode = "list";
            else if (matchesKey(data, Key.up)) detailScroll = Math.max(0, detailScroll - 1);
            else if (matchesKey(data, Key.down)) {
              const lines = detailContent.split("\n");
              const max = Math.max(0, lines.length - 25);
              detailScroll = Math.min(max, detailScroll + 1);
            }
          }
          tui.requestRender();
        };
        const invalidate = () => {};
        return { render, invalidate, handleInput };
      });
    },
  });
}
