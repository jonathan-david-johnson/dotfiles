# Procedures

Use this module for instructions that readers must perform.

## Structure

- State the outcome first: what the reader will accomplish.
- State prerequisites, permissions, dependencies, warnings, and conditions before the steps that depend on them.
- Use a numbered list for steps that must occur in sequence.
- Give one primary action per step. Split a step when a reader must make a decision, verify a result, or change tools.
- Start steps with an action verb.
- Name the system, location, command, UI element, or owner precisely.
- Include expected results at meaningful checkpoints, especially after destructive, risky, or hard-to-reverse actions.
- Put alternatives and exceptions next to the step they affect.
- End with a verification or completion condition when one is available.

## Example pattern

1. Confirm that `<prerequisite>` is true.
2. In **<UI area>**, select **<control>**.
3. Enter `<literal value>`.
4. Verify that `<expected result>` appears.

## Avoid

- Hiding a prerequisite after the reader has started the procedure.
- Combining several actions with "and then" when the reader needs to verify between them.
- Calling an action easy, simple, or quick.
- Using vague verbs such as "handle," "deal with," or "configure" without identifying the specific action.
