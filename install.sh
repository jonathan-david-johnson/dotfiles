#!/usr/bin/env bash
# Symlink dotfiles into $HOME. Safe to re-run.
# Existing files are moved to <name>.bak.<timestamp> before linking.
#
# Usage: ./install.sh [-n]   (-n = dry run)

set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS="$(uname -s)" # Linux | Darwin
STAMP="$(date +%Y%m%d%H%M%S)"
DRY=0
[[ "${1:-}" == "-n" ]] && DRY=1

run() { if ((DRY)); then echo "  would: $*"; else "$@"; fi; }
short() { echo "${1/#$HOME/\~}"; }

backup() {
  echo "backup  $(short "$1") -> $(short "$1").bak.$STAMP"
  run mv "$1" "$1.bak.$STAMP"
}

# symlink <absolute source> <absolute destination>
symlink() {
  local src="$1" dst="$2"
  if [[ ! -e "$src" ]]; then
    echo "missing $(short "$src") (skipped)" >&2
    return 0
  fi
  if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then
    echo "ok      $(short "$dst")"
    return 0
  fi
  if [[ -e "$dst" || -L "$dst" ]]; then backup "$dst"; fi
  run mkdir -p "$(dirname "$dst")"
  run ln -s "$src" "$dst"
  echo "linked  $(short "$dst") -> $src"
}

# link <repo path> [home path]  (home path defaults to repo path)
link() { symlink "$DOTFILES/$1" "$HOME/${2:-$1}"; }

# link_each <repo dir> [home dir]: link each entry separately, so the home dir
# stays a real directory that other tools (e.g. Omarchy) can also write into.
link_each() {
  local entry
  for entry in "$DOTFILES/$1"/*; do
    [[ -e "$entry" ]] || continue
    link "$1/${entry##*/}" "${2:-$1}/${entry##*/}"
  done
}

# retire <home path>: move aside a file the linked config supersedes
retire() {
  if [[ -e "$HOME/$1" || -L "$HOME/$1" ]]; then backup "$HOME/$1"; fi
}

# merge_json <home path> <repo shared file> [repo local file]
# Writes existing * shared * local (later wins; objects merge, arrays replace).
# Keys only the app writes (e.g. pi's deviceId) survive because neither file has them.
merge_json() {
  local dst="$HOME/$1" shared="$DOTFILES/$2" local_="$DOTFILES/${3:-}" merged
  local files=()
  if ! command -v jq >/dev/null; then
    echo "skip    $(short "$dst") (jq not installed)"
    return 0
  fi
  [[ -f "$dst" ]] && files+=("$dst")
  files+=("$shared")
  [[ -n "${3:-}" && -f "$local_" ]] && files+=("$local_")
  merged="$(jq -s 'reduce .[] as $f ({}; . * $f)' "${files[@]}")"
  if [[ -f "$dst" && ! -L "$dst" && "$(jq -S . "$dst")" == "$(jq -S . <<<"$merged")" ]]; then
    echo "ok      $(short "$dst")"
    return 0
  fi
  if [[ -e "$dst" || -L "$dst" ]]; then
    echo "changes $(short "$dst"):"
    diff <(jq -S . "$dst" 2>/dev/null) <(jq -S . <<<"$merged") | sed 's/^/          /' || true
    run cp -P "$dst" "$dst.bak.$STAMP"
    [[ -L "$dst" ]] && run rm "$dst"
  fi
  if ((DRY)); then
    echo "  would: write merged $(short "$dst")"
  else
    mkdir -p "$(dirname "$dst")"
    printf '%s\n' "$merged" >"$dst.tmp.$$" && mv "$dst.tmp.$$" "$dst"
  fi
  echo "merged  $(short "$dst") <- $2${3:+ + $3}"
}

# --- Shared -----------------------------------------------------------------
link .zshenv
link .config/zsh
link .config/fzf
link .config/starship.toml
link .config/mise
retire .zshrc # unused: .zshenv sets ZDOTDIR=~/.config/zsh

# --- pi ---------------------------------------------------------------------
# ~/.pi/agent stays a real directory: auth, sessions, caches, and Omarchy's
# skills/theme live there. Only tracked config is linked in.
if [[ -L "$HOME/.pi" || -L "$HOME/.pi/agent" ]]; then
  echo "skip    ~/.pi: it is a symlink (old layout). Move auth.json and sessions/ into a real ~/.pi/agent, remove the link, and re-run." >&2
else
  link .pi/agent/models.json
  link .pi/agent/mcp.json
  link .pi/agent/agents
  link .pi/agent/extensions
  link .pi/agent/prompts
  link .pi/agent/supi/config.json
  link_each .pi/agent/skills
  link_each .pi/agent/themes
  merge_json .pi/agent/settings.json .pi/agent/settings.json .pi/agent/settings.local.json

  # Matt Pocock's skills: kept as links into a local clone
  pocock="$HOME/code/mattpocock/skills"
  [[ -d "$pocock/.git" ]] || run git clone -q https://github.com/mattpocock/skills.git "$pocock"
  for s in engineering/grill-with-docs engineering/improve-codebase-architecture engineering/tdd productivity/handoff; do
    symlink "$pocock/skills/$s" "$HOME/.pi/agent/skills/${s##*/}"
  done
fi

# --- OS-specific ------------------------------------------------------------
case "$OS" in
  Darwin)
    link .config/nvim # Linux (Omarchy) keeps its own LazyVim config
    ;;
  Linux) ;;
esac
