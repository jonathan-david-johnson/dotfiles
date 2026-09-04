---
name: documentation-style
description: "Apply the local clarity standard when creating, substantially revising, or reviewing documentation. Use for technical documents, procedures, reference material, project notes, decision records, stakeholder updates, and knowledge-base content. Provides progressive guidance: load only the relevant reference module."
---

# Documentation style

## Scope

Use this skill for substantive documentation work. Do not use it to override user instructions, local project style, approved templates, or existing terminology.

## First pass

Before drafting or revising, identify:

1. Audience: who will read this, and what do they already know?
2. Purpose: what should the reader understand, decide, or do?
3. Content type: procedure, reference, decision record, status update, meeting note, investigation, or another format.
4. Local conventions: templates, terminology, required sections, and formatting rules.

## Default writing standard

- Start with the information or action the reader needs most.
- Use plain, concrete language. Replace vague qualifiers with evidence, scope, owner, date, or measurable impact where available.
- Prefer active voice. State who performs an action when responsibility matters.
- Keep one main idea per sentence where practical. Break up sentences that contain multiple conditions, actions, or exceptions.
- Put prerequisites and conditions before the instruction or outcome they affect.
- Use familiar terms consistently. Define an unfamiliar abbreviation or term at first meaningful use unless the intended audience already knows it.
- Distinguish facts, decisions, assumptions, recommendations, open questions, and risks.
- Use sentence case for headings unless a local convention requires otherwise.
- Use numbered lists for ordered actions and unordered lists for collections of related items.
- Use descriptive link text. Do not use bare URLs or vague labels such as "here" when a meaningful label is possible.
- Format code, commands, file names, configuration keys, identifiers, user input, and literal output with code formatting.
- Format UI labels consistently with the local document convention. Use bold if no local convention exists.
- Use dates that cannot be misread. Prefer `2026-06-22` or `June 22, 2026` over numeric regional formats such as `6/22/26`.
- Use accessible text for images and diagrams. Explain the information that the visual conveys when the document depends on it.

## Progressive disclosure

Read only the reference that matches the document work:

- For steps that readers must perform, read `references/procedures.md`.
- For technical reference pages, configuration guidance, APIs, or commands, read `references/reference-docs.md`.
- For rewrites, stakeholder-facing writing, ambiguous language, jargon, or tone concerns, read `references/tone-and-language.md`.
- For a final quality check or review request, read `references/review.md`.

For mixed documents, read the smallest set of modules necessary. Do not load all modules by default.

## Document-specific exceptions

- Meeting notes and transcripts should preserve source attribution, chronology, and uncertainty. Do not rewrite them into fictional certainty.
- Decision records should retain rejected alternatives and decision rationale when those details matter for later readers.
- Status updates should lead with status, impact, blockers, owner, and next checkpoint. Do not force tutorial-like second-person wording.
- HR, legal, customer, executive, and sensitive documents must match their audience and applicable local rules. Clarity does not authorize disclosure of sensitive information.

## Finish

Before finalizing, verify the document fulfills its purpose, follows local requirements, and lets its intended reader find the next action or conclusion quickly. Load `references/review.md` for a substantive review.
