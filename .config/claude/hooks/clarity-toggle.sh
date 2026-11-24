#!/bin/bash
# Toggle clarity mode. Usage: clarity-toggle.sh [on|off|status|toggle]
# State lives in $CLAUDE_CONFIG_DIR/.clarity-mode; a missing file means on.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
STATE="$CLAUDE_DIR/.clarity-mode"

current() {
  if [ -f "$STATE" ] && [ "$(tr -d '[:space:]' <"$STATE" | tr '[:upper:]' '[:lower:]')" = "off" ]; then
    echo off
  else
    echo on
  fi
}

now="$(current)"
arg="$(echo "${1:-toggle}" | tr '[:upper:]' '[:lower:]')"

case "$arg" in
  status)
    echo "Clear mode: $(echo "$now" | tr '[:lower:]' '[:upper:]')"
    exit 0
    ;;
  on)  next=on ;;
  off) next=off ;;
  toggle|"") [ "$now" = "on" ] && next=off || next=on ;;
  *)
    echo "Unknown argument: $arg (expected on, off, status, or toggle)" >&2
    exit 1
    ;;
esac

printf '%s\n' "$next" >"$STATE"
echo "Clear mode: $(echo "$next" | tr '[:lower:]' '[:upper:]')"
