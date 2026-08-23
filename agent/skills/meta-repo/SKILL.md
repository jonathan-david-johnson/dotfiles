---
name: meta-repo
description: Set up or extend a multi-platform "monorepo shell" project — top-level Makefile delegating to per-platform nested repos, docs/<platform>/ layout with milestones and bugs, ADRs, and sub-agent fan-out plans. Use when the user says "set up a new platform", "scaffold docs for X", "add a milestone", "create a bug doc", or asks about the project's repo/docs structure conventions.
---

# Meta-Repo

Conventions for a product shipped to multiple platforms (iOS, Android,
menubar, Roku, web, etc.), where each platform lives in its own nested git
repo under a shared top-level shell. Reference implementation:
`PocketRadio/docs/REPO_STRUCTURE.md`.

## When to Trigger

- "scaffold docs for `<new platform>`"
- "set up a new milestone for `<platform>`"
- "create a bug doc" / "log a global bug" / "log a `<platform>` bug"
- "what's our repo structure convention" / "how do we organize docs"
- Cross-platform parity check: "does `<feature>` work the same on all platforms"

## Quick Start

Top-level layout: `docs/bugs/` (global), `docs/<platform>/{README,
current_milestone.md -> milestones/milestone_N.md, bugs/, milestones/}`, plus
a nested git repo per implemented platform. Top-level `Makefile` only
delegates (`@$(MAKE) -C $(<PLATFORM>_DIR) <target>`); real logic lives in each
platform's own Makefile. Full diagram: [REFERENCE.md](REFERENCE.md#layout).

## Tasks

Pick the matching section in [REFERENCE.md](REFERENCE.md):

1. **Scaffold a new platform** — create docs tree, milestone_0, symlink, bugs
   dir, Makefile delegation. → [REFERENCE.md](REFERENCE.md#task-scaffold-a-new-platform)
2. **Create/advance a milestone** — never edit through the symlink; required
   sections incl. `## Behaviors to test` (the fan-out list). →
   [REFERENCE.md](REFERENCE.md#task-createadvance-a-milestone)
3. **Log a bug** — global vs platform-local, `## Symptom` format. →
   [REFERENCE.md](REFERENCE.md#task-log-a-bug)
4. **Cross-platform parity check** — verify each platform's implementation
   before claiming consistency; don't silently pick a "reference" platform.
   → [REFERENCE.md](REFERENCE.md#task-cross-platform-parity-check)

## Sub-Agent Fan-Out

A milestone's `## Behaviors to test` list is the parallelization unit — one
sub-agent per behavior (or small independent cluster), given only the
milestone's Goal + relevant Scope bullets + its behavior number(s). Details:
[REFERENCE.md](REFERENCE.md#sub-agent-fan-out).

## Rules

1. Top-level Makefile = delegation + repo admin only.
2. Don't write through milestone symlinks.
3. Don't assume cross-platform parity — verify per-platform.
4. Bug docs are append-only history.
5. Milestone/bug status lives in `docs/`, not agent memory — derive current state from `current_milestone.md` symlinks and bug docs each session; don't cache project status across sessions, it goes stale silently.
