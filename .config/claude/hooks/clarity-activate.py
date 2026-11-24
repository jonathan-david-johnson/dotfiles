#!/usr/bin/env python3
"""SessionStart hook for clarity mode.

Port of the pi extension at ~/.pi-toshiba/agent/extensions/clarity.ts.
Reads ~/.claude/.clarity-mode; a missing file means on, matching the
extension's DEFAULT_ENABLED. Emits the supplemental communication
instruction as SessionStart additionalContext when on, nothing when off.

Toggle with /clarity on|off|status, which calls clarity-toggle.sh.
"""

import json
import os
import sys

# Trimmed against Claude Code's built-in "Writing for the user" rules, which
# already cover lead-with-the-answer, short sentences, active voice, and no
# filler. Only the additive parts live here.
CLARITY_INSTRUCTION = """## Communication style: Clear mode

- Separate verified facts from assumptions, recommendations, and open questions. Say which is which.
- Keep routine status and completion updates short. Expand when a decision, risk, plan, or explanation needs it.
- Name the actor when responsibility is not obvious from context.
- When creating, substantially revising, or reviewing documentation, use the documentation-style skill."""


def state_path() -> str:
    cfg = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(
        os.path.expanduser("~"), ".claude"
    )
    return os.path.join(cfg, ".clarity-mode")


def enabled() -> bool:
    path = state_path()
    if not os.path.isfile(path) or os.path.islink(path):
        return True
    try:
        with open(path, "rb") as f:
            return f.read(16).strip().lower() != b"off"
    except OSError:
        return True


def main() -> None:
    # Drain stdin so the harness never blocks on an unread pipe.
    try:
        sys.stdin.read()
    except Exception:
        pass

    if not enabled():
        return

    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": CLARITY_INSTRUCTION,
            }
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
