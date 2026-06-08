---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use when the user says "handoff," "create handoff," or needs to summarize session state for a fresh agent.
argument-hint: What will the next session be used for?
---

# Handoff

Compress the current conversation into a dense, actionable handoff document so a fresh agent can continue the work without replaying the entire session.

## When to Trigger

- User says "handoff" or "create handoff"
- User says "summarize session" or "write handoff doc"
- User wants to save session state before switching tasks or models
- End of a long session when the user is about to start a new thread

## Output Rules

1. **Save to the temporary directory of the user's OS, not the current workspace.** On macOS, use `/tmp/` or `$TMPDIR`. Do not write the handoff into the project repository.

2. **Do not duplicate content already captured in other artifacts** — PRDs, plans, ADRs, issues, milestone docs, commits, diffs. Reference them by absolute path or URL instead.

3. **Redact any sensitive information** — API keys, passwords, tokens, personally identifiable information. Reference them by constant name or credential store location, never inline them.

4. **If the user passed arguments** (the argument-hint), treat them as a description of what the next session will focus on. Tailor the document toward that focus. If no arguments were passed, cover the full session state.

5. **Name the file descriptively** with a date, e.g. `projectname-handoff-2026-01-15.md`.

## Handoff Document Structure

```markdown
# [Project Name] — Session Handoff

> Created: [date] | Uncommitted changes: yes/no

## Reference Artifacts
- [links to project handoff, milestone docs, ADRs, PRDs, etc. by path or URL]
- [git commit references]

## What Was Done This Session
[Bulleted list of completed items, grouped by topic. Reference commits where applicable.]

## What's Working
- ✅ [item]
- ✅ [item]

## What's NOT Working / Needs Attention
- ❌ [item with explanation of root cause if known]

## Current State of Working Tree
[If uncommitted changes exist, list files and approximate change size.]

## Suggested Next Steps
[Ordered list of concrete next actions, referencing milestone docs by path.]

## Suggested Skills for Next Agent
- `skill-name` — [why this skill would be useful for the next session]

## Key Project Paths
| Path | Purpose |
|------|---------|
| ... | ... |

## Build & Run
```bash
cd [project-path]
[build command]
```
```

## Rules for Content

1. **Be concise.** The handoff is for a fresh agent that can read code. Don't explain architecture that's already documented.
2. **Be actionable.** Every "next step" should be something the next agent can start immediately without reading the full conversation.
3. **Include breadcrumbs.** Mention file paths, function names, and line numbers when describing specific issues so the next agent can find them quickly.
4. **Mark uncertainty.** If you're not sure about the root cause of a bug, say so. Don't speculate as fact.
5. **Note uncommitted changes.** The next agent needs to know if they should start with `git status` before making changes.
