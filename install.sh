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

backup() {
  local dst="$1"
  echo "backup  ${dst/#$HOME/\~} -> ${dst/#$HOME/\~}.bak.$STAMP"
  run mv "$dst" "$dst.bak.$STAMP"
}

# link <repo path> [home path]  (home path defaults to repo path)
link() {
  local src="$DOTFILES/$1" dst="$HOME/${2:-$1}"
  [[ -e "$src" ]] || { echo "missing $src" >&2; return 1; }
  if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then
    echo "ok      ${dst/#$HOME/\~}"
    return
  fi
  [[ -e "$dst" || -L "$dst" ]] && backup "$dst"
  run mkdir -p "$(dirname "$dst")"
  run ln -s "$src" "$dst"
  echo "linked  ${dst/#$HOME/\~} -> $src"
}

# retire <home path>: move aside a file the linked config supersedes
retire() {
  local dst="$HOME/$1"
  if [[ -e "$dst" || -L "$dst" ]]; then backup "$dst"; fi
}

# --- Shared -----------------------------------------------------------------
link .zshenv
link .config/zsh
link .config/fzf
retire .zshrc # unused: .zshenv sets ZDOTDIR=~/.config/zsh

# --- OS-specific ------------------------------------------------------------
case "$OS" in
  Darwin) ;;
  Linux) ;;
esac
