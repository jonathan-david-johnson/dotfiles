---
name: agentic-progressive-disclosure
description: Design, audit, or improve a repository's progressive instruction architecture using AGENTS.md at independent agent working boundaries and direct links to leaf code or documentation. Use when making important tools discoverable, deciding where AGENTS.md files belong, reducing oversized agent instructions, or creating task-based routing for future coding sessions.
---

# Agentic progressive disclosure

Build an instruction system in which a new agent receives enough context to choose the next relevant source without loading the whole repository.

The core rule is:

> Put `AGENTS.md` where an agent may independently enter and work. Route from that boundary to the code, documentation, tools, or more specialized working boundaries it may need.

The disclosure chain may end at ordinary source code, a README, an ADR, a runbook, or another canonical document. A leaf does not need its own `AGENTS.md`.

## Preserve local authority

Before assessing or changing the instruction structure:

1. Find and read the applicable instruction files from the repository root through the target area.
2. Follow local naming, compatibility-file, documentation, and commit conventions.
3. Treat existing source, tests, ADRs, milestones, and runbooks as authoritative for their respective facts.
4. Do not replace local conventions with this skill. Use this skill to organize discovery of them.
5. Do not edit, commit, or move files unless the user requested implementation rather than analysis.

## Classify the repository

Inventory the repository before proposing new instruction files. Look for:

- nested repositories, packages, applications, services, and deployable components;
- directories that have their own build, test, run, release, or operational workflow;
- locations where a user might reasonably start a focused agent session;
- important but easily missed tools, scripts, fixtures, reviews, ADRs, and runbooks;
- existing `AGENTS.md` files and claims they make about other guides;
- generated, temporary, vendored, archived, or private areas that should not become navigation targets.

Classify each relevant area as one of these:

### Working boundary

Create or retain `AGENTS.md` when a new session might start in that directory and work there independently. Supporting signals include:

- its own build or test entry point;
- a distinct language, runtime, dependency graph, or release lifecycle;
- local safety, privacy, or architectural invariants;
- independent branching, ownership, or deployment;
- enough internal complexity that a parent summary cannot safely guide changes.

A likely independent session is sufficient reason. Do not require every supporting signal.

### Leaf

Route directly to a leaf when it is something an agent may inspect or use but is not a sensible independent working root. Common leaves include:

- a single diagnostic script;
- a focused README or runbook;
- an ADR, milestone, review, or protocol;
- a source module whose normal project instructions are sufficient;
- a fixture or test-data directory.

Do not add `AGENTS.md` merely to continue the tree. Promote a leaf to a working boundary later if its workflow becomes independent.

### Not a target

Do not route agents into generated output, caches, temporary handoffs, dependencies, or obsolete archives unless a task explicitly requires them.

## Build task-based routes

At every working boundary, route by the task an agent is trying to perform. Prefer this form:

```markdown
| If you need to… | Read or use… |
|---|---|
| Diagnose the raw network protocol | `tools/protocol-probe.py` |
| Change the application adapter | `src/adapters/README.md` |
| Work independently on the replay package | `tools/replay/AGENTS.md` |
```

A useful route answers three questions:

1. **When** should the agent follow it?
2. **Where** is the most specific authoritative next source?
3. **Why** is that source appropriate, especially when nearby tools have overlapping names or responsibilities?

Link to the most specific useful source. Do not send an agent through several index files when a direct route is stable and clear.

## Write boundary guides

An `AGENTS.md` at a working boundary should be concise but sufficient for a session that starts there. Include only sections that add value:

1. **Scope:** what this boundary owns and excludes.
2. **Read first:** mandatory local sources and when they apply.
3. **Task routing:** important child boundaries and leaves, selected by intent.
4. **Commands:** canonical build, test, run, lint, or validation entry points.
5. **Invariants:** safety, privacy, architectural, generated-file, and workflow constraints.
6. **Current-work pointer:** where active milestones or handoffs live, without copying their changing status.
7. **Parent or cross-system context:** how to find broader instructions when the surrounding checkout is available.

A child guide must not assume the parent guide was loaded automatically. Repeat only the minimum critical invariant needed to work safely from the child boundary, then link to canonical detail.

When drafting a new guide, read [the boundary guide template](references/boundary-guide-template.md). Adapt it; do not fill every section mechanically.

## Keep instructions durable

Put stable routing and rules in `AGENTS.md`. Put changing facts elsewhere.

Keep in `AGENTS.md`:

- ownership and scope boundaries;
- canonical commands;
- durable invariants;
- “when to read what” routing;
- locations of current-work documents.

Keep out of `AGENTS.md`:

- current test counts or temporary failures;
- branch tips, dirty-file lists, and session state;
- large architecture explanations already maintained elsewhere;
- exhaustive file listings that will quickly drift;
- copied procedures with another canonical home;
- credentials, secrets, personal data, or transient local paths.

Use milestones, issue documents, handoffs, runbooks, or generated status for changing information.

## Handle overlapping tools explicitly

When two tools overlap, route by evidence boundary rather than declaring one redundant. State:

- what each tool observes or changes;
- whether it uses the production path, a parallel connection, a mock, or offline data;
- what conclusions each tool can and cannot support;
- which tool to use first for a given question.

This prevents a fast diagnostic probe from being mistaken for an application-level integration test, or a replay harness from being mistaken for live-system evidence.

## Audit the disclosure path

After writing or revising guides, simulate representative new sessions:

1. Start from each likely working directory.
2. Pick a concrete task without relying on prior repository knowledge.
3. Confirm the applicable `AGENTS.md` identifies the next source.
4. Follow the route until it reaches authoritative code or documentation.
5. Confirm the path does not require unrelated context.
6. Confirm every advertised guide and file exists.
7. Confirm a leaf is not incorrectly presented as an independent subsystem.
8. Check that duplicated facts agree or, preferably, are replaced by one canonical link.

Use [the audit checklist](references/audit-checklist.md) for a substantive repository audit.

## Report the result

Separate:

- **Verified structure:** what exists and resolves now.
- **Gaps:** important tasks or entry points that are not discoverable.
- **Recommendations:** new boundaries, routes, or leaf links.
- **Changes made:** exact paths created or modified.
- **Validation:** link checks, formatting checks, and session-path simulations performed.

If no new `AGENTS.md` is warranted, say so. A shorter, correct disclosure path is better than a deeper tree.
