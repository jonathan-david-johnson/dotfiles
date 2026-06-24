---
name: self-review
description: Review the last prompt or a span of recent interactions to extract lessons and produce actionable improvements. Use when the user says "review last run," "self-review," "what went wrong," "lessons learned," or "how can we improve."
---

# Self-Review

Systematically review past interactions in the current conversation to extract lessons and produce actionable improvements. The goal is continuous improvement of the human-agent system — not blame, not criticism, but concrete changes.

## When to Trigger

- User says "review last run" or "review the last prompt"
- User says "self-review" or "what went wrong"
- User says "lessons learned" or "how can we improve"
- User asks to analyze a failure or suboptimal outcome

## Scope

Review the user-specified span of the conversation. If the user says "last run," review the most recent task or prompt exchange. If they say "last few runs," review the last 3-5 prompt-response cycles. The user may specify a boundary ("up to the point where...").

## Review Framework

For the span under review, examine:

1. **What was the user's intent?** What did they actually want?
2. **What happened?** Trace the sequence of actions taken.
3. **What went well?** Things that worked, efficient choices, good judgments.
4. **What went wrong?** Mistakes, inefficiencies, wrong tool choices, parallel calls that failed, skipped steps, ignored instructions.
5. **Root cause.** Why did the wrong thing happen? Don't stop at symptoms — dig to the underlying cause (ambiguous instructions, missing guardrails, lack of prerequisite checks, etc.).

## Outcome Categories

For each lesson identified, assign it to one or more outcome categories:

### A. Repository Changes
Changes to the project codebase we're working in. Examples:
- Add a test for a bug that slipped through
- Fix a configuration file
- Add a lint rule or pre-commit hook
- Document a gotcha in CONTRIBUTING.md or README

### B. Agent Metadata Changes
Changes to agent configuration or skills. Examples:
- Edit a skill's SKILL.md (add priority rules, prerequisites, guardrails)
- Edit agents.md (system prompt, agent behavior rules)
- Create a new skill
- Add an agent instruction to prevent a class of mistakes

### C. User Behavior Changes
Changes in how the user prompts or interacts. Examples:
- Be more specific about which tool to use
- Provide examples or constraints upfront
- Specify scope boundaries more clearly
- Use a different verb or format for certain requests

### D. Nothing
The interaction was optimal — no changes needed. State this explicitly and explain why.

## Output Format

Produce a structured review. Be concise and concrete. Every recommendation must be actionable.

```markdown
## Self-Review: [span description]

### What Happened
[Brief trace of the interaction]

### What Went Well
- [item]
- [item]

### What Went Wrong & Root Cause
- **Issue:** [what happened]
  **Root cause:** [why it happened]
  **Lesson:** [what to learn]

### Recommendations

#### Repo Changes
- [ ] [concrete change]

#### Agent/Skill Changes
- [ ] [concrete change to a specific file]

#### User Behavior Changes
- [ ] [concrete change in how to prompt]

#### No Changes Needed
- [item] — [why it was optimal]
```

## Rules

1. **Be concrete.** Every recommendation must name a specific file, a specific line to change, or a specific phrasing to use. No vague "be more careful."
2. **Root cause, not symptom.** Don't say "the agent made a mistake" — say WHY the agent made that mistake and what structural change prevents it.
3. **No blame.** The system (human + agent + skills + tools) produced the outcome. Fix the system.
4. **Prioritize.** If there are 5 lessons, mark the highest-impact one.
5. **Don't review the self-review.** This skill itself is out of scope for review unless the user explicitly asks.
6. **One issue per recommendation.** Don't bundle multiple fixes into one bullet.
