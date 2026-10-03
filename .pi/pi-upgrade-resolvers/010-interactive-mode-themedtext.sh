#!/usr/bin/env bash
# Conflict resolver for the local trace/grouping patch vs upstream edits to
# interactive-mode.ts, where our `ExpandableText extends ThemedText` collides
# with upstream's `extends Text` + the `TraceItem` interface.
#
# Resolver contract (see pi_safe_upgrade):
#   argv: <worktree-root> <unmerged-file>...
#   Resolve only conflicts you recognize, `git add` what you fully fixed,
#   and leave everything else untouched. Exit status is advisory; the caller
#   re-checks for remaining unmerged files afterward. Must be idempotent and a
#   no-op when the conflict it targets is absent, so it is safe on any version.
#
# Safety rules:
#   - A conflict hunk is only resolved when BOTH sides consist solely of lines
#     the fix knows about (plus context lines shared by both sides). If either
#     side carries anything unexpected, the hunk is left for manual review
#     instead of silently discarding upstream's change.
#   - The file is staged only if this resolver actually rewrote a hunk AND no
#     conflict markers remain. Delete/modify conflicts (which git leaves with
#     no markers) therefore stay unmerged for a human.
set -euo pipefail

wt="${1:?worktree root required}"; shift || true
target="packages/coding-agent/src/modes/interactive/interactive-mode.ts"

# Only act when our target file is one of the unmerged paths.
hit=""
for f in "$@"; do [[ "$f" == "$target" ]] && hit=1; done
[[ -n "$hit" ]] || exit 0

file="$wt/$target"
[[ -f "$file" ]] || exit 0

# Match on conflict *content*, not the `>>>>>>> <sha>` label, since our patch
# commit is recreated (new SHA) on every rebase. Leaves unrelated conflict
# hunks in the same file alone so they still surface for manual review.
py_rc=0
python3 - "$file" <<'PY' || py_rc=$?
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

merged = (
    "/** A reasoning and tool-call trace that can be temporarily hidden from the transcript. */\n"
    "interface TraceItem {\n"
    "\tsetTraceVisible(visible: boolean): void;\n"
    "}\n\n"
    "class ExpandableText extends ThemedText implements Expandable {\n"
    "\tprivate readonly state: { expanded: boolean };"
)

# Every line the fix is allowed to discard from either side. Anything unique
# to one side that is NOT in this set means upstream changed something nearby;
# refuse rather than delete it without warning. (Lines present in both sides
# are shared context and need no review.)
KNOWN = {
    "",
    "/** A reasoning and tool-call trace that can be temporarily hidden from the transcript. */",
    "interface TraceItem {",
    "setTraceVisible(visible: boolean): void;",
    "}",
    "class ExpandableText extends ThemedText implements Expandable {",
    "class ExpandableText extends Text implements Expandable {",
    "class ExpandableText extends Text {",
    "private readonly state: { expanded: boolean };",
}

block = re.compile(
    r"<<<<<<< [^\n]*\n(?P<a>.*?)\n=======\n(?P<b>.*?)\n>>>>>>> [^\n]*\n",
    re.S,
)

resolved_any = False

def resolve(m):
    global resolved_any
    a, b = m.group("a"), m.group("b")
    sides = a + "\n" + b
    if not (
        "class ExpandableText extends ThemedText" in sides
        and "class ExpandableText extends Text" in sides
        and "interface TraceItem" in sides
    ):
        return m.group(0)  # not our conflict; leave it for manual review
    a_lines = {ln.strip() for ln in a.splitlines()}
    b_lines = {ln.strip() for ln in b.splitlines()}
    unexpected = (a_lines ^ b_lines) - KNOWN
    if unexpected:
        print(
            "resolver: refusing to auto-resolve; unexpected line(s) in conflict: "
            + ", ".join(sorted(repr(u) for u in unexpected)),
            file=sys.stderr,
        )
        return m.group(0)
    resolved_any = True
    return merged + "\n"

new = block.sub(resolve, text)
if not resolved_any:
    sys.exit(2)  # nothing safely resolved; advise caller we did not help
path.write_text(new)
PY

# Stage the file only when our own fix actually ran (py_rc == 0) and no
# conflict markers remain. If other, unrecognized hunks keep the file
# conflicted, or the fix never applied, leave it unmerged for manual handling.
if [[ "$py_rc" -eq 0 ]] && ! grep -q '^<<<<<<< ' "$file"; then
  git -C "$wt" add "$target"
fi
exit 0
