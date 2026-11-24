#!/usr/bin/env bash
# Push this Mac's pi config to the host "pop" (ssh alias).
#
# Synced:   extensions, agents, skills, themes, prompts, models.json, the
#           pi-clarity repo, shared keys in settings.json, and the MCP servers
#           in mcp.json that work off-Mac (see MCP_SKIP).
# Symlinks (skills point into other repos) are copied as real files.
# Not sent: auth.json and mcp-auth.json (logins; run 'pi mcp login <name>' on
#           pop), sessions, trust.json,
#           and the pop-only settings keys listed in merge_settings below.
#
# Additive: nothing is deleted on pop, except that the extensions in
# POP_SKIP are never sent (they were deliberately removed from pop).
#
# Run after you change anything under ~/.pi/agent or ~/pi-clarity:
#   ~/.pi/scripts/sync-to-pop.sh          # do it
#   ~/.pi/scripts/sync-to-pop.sh -n       # dry run (rsync only; settings merge is printed, not written)
set -euo pipefail

HOST=pop
SRC="$HOME/.pi/agent"
DRY=""
[[ "${1:-}" == "-n" ]] && DRY="-n"

# Extensions that stay off pop: removed on request, or tied to macOS.
POP_SKIP=(btw.ts caveman.ts caveman.ts.disabled ocr.ts security-guard.ts subagent
          playwright-mcp.ts context7 clarity.ts)
EXCL=(--exclude .DS_Store)
for s in "${POP_SKIP[@]}"; do EXCL+=(--exclude "/$s"); done

RS=(rsync -rLt --itemize-changes $DRY)

echo "== extensions"
"${RS[@]}" "${EXCL[@]}" "$SRC/extensions/" "$HOST:.pi/agent/extensions/"

echo "== agents, skills, themes, prompts"
for d in agents skills themes prompts; do
  ssh "$HOST" "mkdir -p ~/.pi/agent/$d"
  "${RS[@]}" --exclude .DS_Store "$SRC/$d/" "$HOST:.pi/agent/$d/"
done

echo "== models.json"
"${RS[@]}" "$SRC/models.json" "$HOST:.pi/agent/models.json"

echo "== pi-clarity (extension target + skill)"
"${RS[@]}" --exclude .git --exclude logs --exclude .DS_Store "$HOME/pi-clarity/" "$HOST:pi-clarity/"
[[ -z "$DRY" ]] && ssh "$HOST" 'ln -sfn ~/pi-clarity/clarity.ts ~/.pi/agent/extensions/clarity.ts'

echo "== settings.json"
merge_settings() {
python3 - "$SRC/settings.json" "$1" <<'PY'
import json, sys
mac = json.load(open(sys.argv[1]))
pop = json.load(open(sys.argv[2]))
# Keys copied from the Mac. Everything else (defaultProvider, defaultModel,
# defaultThinkingLevel, lastChangelogVersion, ...) stays as pop has it.
for k in ("theme", "hideThinkingBlock", "enabledModels", "terminal", "warnings"):
    if k in mac:
        pop[k] = mac[k]
# Packages: add Mac packages pop lacks; match on name ignoring @version.
def base(p): return p.rsplit("@", 1)[0] if p.count("@") > (1 if p.startswith("npm:@") else 0) else p
have = {base(p) for p in pop.get("packages", [])}
pop.setdefault("packages", []).extend(p for p in mac.get("packages", []) if base(p) not in have)
print(json.dumps(pop, indent=2))
PY
}
tmp=$(mktemp); trap 'rm -f "$tmp" "$tmp.new"' EXIT
ssh "$HOST" 'cat ~/.pi/agent/settings.json' > "$tmp"
merge_settings "$tmp" > "$tmp.new"
if [[ -n "$DRY" ]]; then cat "$tmp.new"; else
  ssh "$HOST" 'cp ~/.pi/agent/settings.json ~/.pi/agent/settings.json.bak-sync'
  ssh "$HOST" 'cat > ~/.pi/agent/settings.json' < "$tmp.new"
fi

echo "== mcp.json"
# Add Mac servers pop lacks; never overwrite pop's own entries.
# MCP_SKIP: Mac servers not copied as-is. lsp has Mac paths, so pop gets its
# own entry (POP_OVERRIDES below). It needs on pop: ~/go/bin/mcp-language-server
# (go install github.com/isaacphi/mcp-language-server@latest, Go in ~/.local/go)
# and typescript-language-server in the nvm global bin. Its workspace is "."
# (the directory pi starts in), not a fixed project. The language server needs
# a typescript install in that project (npm i -D typescript).
MCP_SKIP=lsp
mcp_merge() {
python3 - "$SRC/mcp.json" "$1" "$MCP_SKIP" <<'PY'
import json, sys
mac = json.load(open(sys.argv[1]))
try: pop = json.load(open(sys.argv[2]))
except Exception: pop = {}
skip = set(sys.argv[3].split(","))
NVM = "/home/jdj/.nvm/versions/node/v25.9.0/bin"
POP_OVERRIDES = {
    "lsp": {
        "command": "/home/jdj/go/bin/mcp-language-server",
        "args": ["--workspace", ".",
                 "--lsp", NVM + "/typescript-language-server", "--", "--stdio"],
        "env": {"PATH": NVM + ":/usr/local/bin:/usr/bin:/bin"},
        "lifecycle": "lazy",
    },
}
srv = pop.setdefault("mcpServers", {})
for k, v in POP_OVERRIDES.items():
    srv.setdefault(k, v)
for k, v in mac.get("mcpServers", {}).items():
    if k not in skip and k not in srv: srv[k] = v
print(json.dumps(pop, indent=2))
PY
}
ssh "$HOST" 'cat ~/.pi/agent/mcp.json 2>/dev/null || echo {}' > "$tmp"
mcp_merge "$tmp" > "$tmp.new"
if [[ -n "$DRY" ]]; then cat "$tmp.new"; else
  ssh "$HOST" 'cat > ~/.pi/agent/mcp.json' < "$tmp.new"
fi

echo "== packages (pop installs any missing on next pi start; run 'pi install' there to force)"
echo "done."
