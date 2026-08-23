# Meta-Repo Reference

## Layout

```
project/
├── Makefile                     # top-level: branch admin + delegation only
├── CLAUDE.md / AGENTS.md
├── docs/
│   ├── bugs/                     # GLOBAL bugs (cross-platform / shared backend)
│   ├── todo.md
│   ├── REPO_STRUCTURE.md         # this convention, project-local copy
│   ├── <platform>/
│   │   ├── README.md
│   │   ├── CONTEXT.md            # optional persistent architecture notes
│   │   ├── current_milestone.md  # symlink -> milestones/milestone_N.md
│   │   ├── adr/                  # optional architecture decision records
│   │   ├── bugs/                 # platform-specific bugs
│   │   └── milestones/
│   │       ├── milestone_0.md
│   │       └── ...
│   └── <other_platform>/...
├── <platform_dir>/                # nested git repo, own Makefile
└── ...
```

Not every platform needs an implementation yet — `docs/<platform>/` with a
`milestone_0.md` roadmap can exist before the nested repo is cloned.

## Task: Scaffold a new platform

- Create `docs/<platform>/README.md`, `docs/<platform>/milestones/milestone_0.md`
  (roadmap-style, scope = "set up project skeleton + CI").
- Symlink `docs/<platform>/current_milestone.md -> milestones/milestone_0.md`.
- Add `docs/<platform>/bugs/` (empty dir is fine, create on first bug).
- Add delegating targets to top-level `Makefile`: `<platform>-build`,
  `<platform>-test`, etc., each `@$(MAKE) -C $(<PLATFORM>_DIR) <target>` —
  do NOT inline real logic at the top level.
- If it's a forked repo, add to `checkout` target + `upstream-remote`.

## Task: Create/advance a milestone

- Never edit through `current_milestone.md` symlink. Create
  `docs/<platform>/milestones/milestone_N+1.md`, then repoint the symlink.
- Required sections: `**Goal:**`, `**User checkpoint:**` (concrete demoable
  scenario), `## Scope` (file/module breakdown), `## Behaviors to test
  (red -> green, one at a time)` (numbered, independently testable — this IS
  the sub-agent fan-out list), `## Out of scope`.
- Each numbered behavior must be: independently verifiable, scoped to named
  files from `## Scope`, small enough for one PR. If too big, split into
  `N.a`/`N.b` or a sub-milestone `milestone_N.1.md`.
- Mid-milestone handoff notes go in `milestone_N_handoff.md`, not edited into
  the milestone's scope.

## Task: Log a bug

- `docs/bugs/bug_N.md` — spans platforms or shared backend (sync API,
  Supabase), can't be fixed by one platform team alone.
- `docs/<platform>/bugs/bug_N.md` — platform-local.
- Format: `# Bug N — <short title>`, `**Status:** Open|Fixed (date)`, then
  one `## Symptom <A/B/...>` section per distinct observed issue (lettered if
  multiple), each with `### Root cause`, `### Fix applied (date)`,
  `### Files changed`. See `docs/console/bugs/bug_1.md` for a worked example.
- Bug docs are append-only history (status changes to Fixed, root cause /
  fix sections added) — don't delete past symptoms once fixed.

## Task: Cross-platform parity check

When a behavior must match across platforms (e.g. completion thresholds,
auth flows), don't assume one platform is "the reference":

1. Grep each platform's implementation for the relevant constant/logic.
2. Report file:line per platform + current values.
3. If inconsistent, ask the user which value is canonical before editing —
   don't silently pick one.
4. Record the agreed value in a `docs/bugs/` doc or ADR so future agents
   don't re-diverge.

## Sub-Agent Fan-Out

The `## Behaviors to test` list in a milestone doc is the fan-out unit. To
parallelize a milestone:

- One sub-agent per numbered behavior (or per small cluster of independent
  behaviors).
- Each sub-agent gets: the milestone's `## Goal`, the relevant `## Scope`
  bullets, and its assigned behavior number(s) — not the whole doc dump.
- Behaviors with stated dependencies on earlier numbers run sequentially or
  after the dependency lands; everything else can run in parallel.
