# Boundary guide template

Use this template only after classifying the directory as an independent agent working boundary. Remove sections that do not help an agent act safely.

```markdown
# <Boundary name>

<One paragraph: what this area owns, what kind of session starts here, and the most important exclusion.>

## Read first

1. `<path>` — required because <reason>.
2. `<path>` — read when <condition>.

## Task routing

| If you need to… | Read or use… | Why |
|---|---|---|
| <task> | `<specific path>` | <authority or evidence boundary> |
| Work independently in <child area> | `<child>/AGENTS.md` | <distinct workflow> |

## Commands

```sh
<canonical build command>
<canonical test command>
<canonical run command>
```

## Invariants

- <Safety, privacy, architecture, generated-file, or workflow rule.>
- <Rule that prevents a plausible costly mistake.>

## Current work

Read `<milestone, issue index, or handoff location>` for current status. Do not infer current status from this guide.

## Broader context

When this directory is inside the full product checkout, read `<parent or cross-system guide>` before cross-boundary changes.
```

## Drafting rules

- Lead with the boundary and the next action, not project history.
- Route by task rather than listing every directory.
- Link directly to stable leaves.
- Link to a child `AGENTS.md` only when the child is itself a working boundary.
- Keep commands executable from the boundary directory, or state the required working directory.
- State exclusions when similarly named tools produce different kinds of evidence.
- Avoid transient branch names, test counts, and dirty-tree state.
- Do not copy detailed architecture or procedures when a maintained canonical document exists.
