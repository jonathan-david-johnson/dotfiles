---
description: Toggle clear communication mode (on|off|status)
allowed-tools: Bash(/Users/jdj/.claude/hooks/clarity-toggle.sh:*)
---

Result of the toggle: !`/Users/jdj/.claude/hooks/clarity-toggle.sh "$ARGUMENTS"`

Report the line above to the user verbatim and nothing else. Do not run any tool.

If it reads `Clear mode: ON`, apply the clear-mode communication rules for the rest of this session even if they were not in your session-start context.

If it reads `Clear mode: OFF`, stop applying them. The instruction may already be in your context from session start; ignore it from here on.
