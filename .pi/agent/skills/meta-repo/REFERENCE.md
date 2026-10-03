# Meta-Repo Reference

Procedures only. Every format and rule referenced below is defined in the
project's `docs/REPO_STRUCTURE.md`; read the named section there before
writing.

## Task: Scaffold a new platform

1. Create `docs/<platform>/README.md` and
   `docs/<platform>/milestones/milestone_0.md` (roadmap-style; scope = "set up
   project skeleton + CI").
2. Symlink `docs/<platform>/current_milestone.md -> milestones/milestone_0.md`.
3. Add `docs/<platform>/bugs/` (create on first bug).
4. Add delegating targets to the top-level `Makefile`: `<platform>-build`,
   `<platform>-test`, etc., each `@$(MAKE) -C $(<PLATFORM>_DIR) <target>` —
   do NOT inline real logic at the top level. Add the dir to the `status`
   repo list.
5. If it's a forked repo, add it to the `checkout` target + `upstream-remote`.
6. Make sure the shell `.gitignore` covers the dir and its future worktrees.
7. Run `make hooks`, then `make hooks-check`.
8. Commit by explicit path on shell `main`.

## Task: Create/advance a milestone

1. Read `current_milestone.md` and the previous milestone for status and
   numbering style (REPO_STRUCTURE § Milestones).
2. Create the next file. **Never write through `current_milestone.md`.**
3. Fill in the shape from REPO_STRUCTURE § Milestone doc shape, including the
   **Where the work happens** table. If the milestone needs a parallel branch,
   name its sibling worktree there.
4. For a feasibility/evidence milestone, use REPO_STRUCTURE § Experiment
   milestones: hypotheses, experiments (question / method / pass / feeds),
   decision gate.
5. Check each behavior or experiment is independently verifiable, scoped to
   named files, and one-PR sized. Split into `N.a`/`N.b` or a sub-milestone
   if not.
6. Repoint the symlink only when the user makes the milestone active.
7. Mid-milestone notes go in a handoff file, not into the milestone's scope.
8. Commit by explicit path on shell `main`.

## Task: Log a bug

1. Decide global (`docs/bugs/`) vs platform (`docs/<platform>/bugs/`): can
   one platform fix it alone?
2. Take the next `bug_N.md` number in that directory.
3. Follow REPO_STRUCTURE § Bugs: status, lettered symptoms, root cause,
   evidence commands, and proposed fix or fix applied.
4. Say plainly what is predicted but not yet confirmed.
5. Append on later updates; never delete past symptoms.

## Task: Cross-platform parity check

When a behavior must match across platforms (e.g. completion thresholds,
auth flows), don't assume one platform is "the reference":

1. Grep each platform's implementation for the relevant constant/logic.
2. Report file:line per platform + current values.
3. If inconsistent, ask the user which value is canonical before editing —
   don't silently pick one.
4. Record the agreed value in a `docs/bugs/` doc, ADR, or `contracts/`
   fixture/spec so future agents don't re-diverge.

## Task: Start parallel platform work

Use when a platform's main checkout is busy with another branch.

1. Confirm the shell is on `main` and the platform's base branch is current:
   `make status`.
2. Create a sibling worktree at the **same depth** as the platform dir:
   ```bash
   git -C <platform_dir> worktree add -b <branch> ../<platform_dir>-<topic> <base>
   ```
3. Copy the untracked files the platform needs (REPO_STRUCTURE § Untracked
   files a new worktree needs). If something new is missing at first build,
   add it to that table.
4. Verify:
   - `git -C <platform_dir>-<topic> rev-parse --git-path hooks` resolves to
     the shell's `.githooks`; or run `make hooks-check`.
   - `git status` in the shell does not list the new dir (gitignored).
   - `make status` shows the worktree under its repo.
5. Fill the milestone's **Where the work happens** table with repo, branch,
   worktree path, and shell changes.
6. Use dedicated simulators/devices or ports where both checkouts would
   collide (e.g. same bundle id on one simulator).
7. Start agent sessions for this work with their working directory set to
   the worktree.

## Task: Finish parallel platform work

1. Merge the branch in the platform repo (user approval per that repo's
   rules).
2. `git -C <platform_dir> worktree remove ../<platform_dir>-<topic>`
3. Delete the branch locally (and on the remote if pushed and merged).
4. Update the milestone status on shell `main`; commit by explicit path.

## Sub-Agent Fan-Out

The `## Behaviors to test` (or `## Experiments`) list in a milestone doc is
the fan-out unit. To parallelize a milestone:

- One sub-agent per numbered item (or per small cluster of independent items).
- Each sub-agent gets: the milestone's `## Goal`, the **Where the work
  happens** table, the relevant `## Scope` bullets, and its assigned item
  number(s) — not the whole doc dump.
- Items with stated dependencies on earlier numbers run sequentially or
  after the dependency lands; everything else can run in parallel.

## Seed for a new project

Use only when a project has no `docs/REPO_STRUCTURE.md`. Copy
`PocketRadio/docs/REPO_STRUCTURE.md` if available and strip project
specifics; otherwise start from this minimum and grow it:

```
project/                     # shell repo, always on `main`
├── Makefile                 # repo admin + delegation only
├── AGENTS.md / CLAUDE.md    # CLAUDE.md is a one-line @AGENTS.md pointer
├── .githooks/
├── contracts/               # shared fixtures + features/<area>/*.feature
├── docs/
│   ├── REPO_STRUCTURE.md    # conventions (owns formats + rules)
│   ├── bugs/
│   └── <platform>/{README.md, current_milestone.md -> milestones/milestone_0.md,
│                   bugs/, milestones/, experiments/}
├── <platform_dir>/          # nested git repo, gitignored by the shell
└── <platform_dir>-<topic>/  # optional sibling worktree, gitignored
```
