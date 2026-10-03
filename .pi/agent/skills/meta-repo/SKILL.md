---
name: meta-repo
description: Set up or extend a multi-platform "monorepo shell" project — top-level Makefile delegating to per-platform nested repos, docs/<platform>/ layout with milestones, experiments, and bugs, ADRs, shared contracts, parallel platform worktrees, and sub-agent fan-out plans. Use when the user says "set up a new platform", "scaffold docs for X", "add a milestone", "plan experiments", "create a bug doc", "start parallel work / a worktree", or asks about the project's repo/docs/branch conventions.
---

# Meta-Repo

Procedures for a product shipped to multiple platforms (iOS, Android,
menubar, Roku, web, etc.), where each platform lives in its own nested git
repo under a shared top-level shell.

**Conventions live in the project, not here.** Read the project's
`docs/REPO_STRUCTURE.md` before any task: it owns layout, file formats,
milestone and bug shapes, and the branch/worktree rules. This skill owns the
step-by-step procedures. Reference implementation:
`PocketRadio/docs/REPO_STRUCTURE.md`. If a project has no
`REPO_STRUCTURE.md` yet, seed it from
[REFERENCE.md](REFERENCE.md#seed-for-a-new-project).

## When to Trigger

- "scaffold docs for `<new platform>`"
- "set up a new milestone for `<platform>`" / "plan experiments for X"
- "create a bug doc" / "log a global bug" / "log a `<platform>` bug"
- "start parallel work on `<platform>`" / "set up a worktree"
- "what's our repo structure / branch convention"
- Cross-platform parity check: "does `<feature>` work the same on all platforms"

## Tasks

Pick the matching section in [REFERENCE.md](REFERENCE.md):

1. **Scaffold a new platform** → [REFERENCE.md](REFERENCE.md#task-scaffold-a-new-platform)
2. **Create/advance a milestone** (incl. experiment milestones) →
   [REFERENCE.md](REFERENCE.md#task-createadvance-a-milestone)
3. **Log a bug** → [REFERENCE.md](REFERENCE.md#task-log-a-bug)
4. **Cross-platform parity check** →
   [REFERENCE.md](REFERENCE.md#task-cross-platform-parity-check)
5. **Start parallel platform work** (sibling worktree) →
   [REFERENCE.md](REFERENCE.md#task-start-parallel-platform-work)
6. **Finish parallel platform work** →
   [REFERENCE.md](REFERENCE.md#task-finish-parallel-platform-work)

## Sub-Agent Fan-Out

A milestone's `## Behaviors to test` (or `## Experiments`) list is the
parallelization unit. Details:
[REFERENCE.md](REFERENCE.md#sub-agent-fan-out).

## Rules

1. Read `docs/REPO_STRUCTURE.md` first; it wins over this skill.
2. Top-level Makefile = delegation + repo admin only.
3. Don't write through milestone symlinks.
4. Don't assume cross-platform parity — verify per-platform.
5. Bug docs are append-only history.
6. The shell stays on `main`; code happens on platform branches. Shell
   changes during platform work are additive only.
7. In the shell, stage explicit paths only — never `git add -A`, `git add .`,
   `git add docs/`, or `git commit -a`. Other sessions share the checkout.
8. Milestone/bug status lives in `docs/`, not agent memory — derive current
   state from `current_milestone.md` symlinks, bug docs, and `make status`
   each session; don't cache project status across sessions, it goes stale
   silently.
