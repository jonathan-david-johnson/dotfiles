#!/usr/bin/env bash
# Preserve upstream output padding and the local tool-group status helper.
# Resolve only this exact insertion conflict; leave unknown changes untouched.
set -euo pipefail

wt="${1:?worktree root required}"; shift || true
target="packages/coding-agent/src/modes/interactive/components/tool-execution.ts"
hit=""
for f in "$@"; do [[ "$f" == "$target" ]] && hit=1; done
[[ -n "$hit" ]] || exit 0
file="$wt/$target"
[[ -f "$file" ]] || exit 0

py_rc=0
python3 - "$file" <<'PY' || py_rc=$?
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
padding = (
    "\tsetOutputPad(outputPad: number): void {\n"
    "\t\tthis.outputPad = outputPad;\n"
    "\t\tthis.updateDisplay();"
)
status = (
    '\tgetStatus(): "running" | "completed" | "failed" {\n'
    '\t\tif (!this.result || this.isPartial) return "running";\n'
    '\t\treturn this.result.isError ? "failed" : "completed";'
)
block = re.compile(
    r"^<<<<<<< [^\n]*\n(?P<a>.*?)\n=======\n(?P<b>.*?)\n>>>>>>> [^\n]*\n\t}\n",
    re.S | re.M,
)
resolved_any = False


def resolve(match):
    global resolved_any
    a, b = match.group("a"), match.group("b")
    if (a, b) not in ((padding, status), (status, padding)):
        return match.group(0)
    resolved_any = True
    return padding + "\n\t}\n\n" + status + "\n\t}\n"


new = block.sub(resolve, text)
if not resolved_any:
    sys.exit(2)
path.write_text(new)
PY

# Never stage an unknown hunk or a markerless delete/modify conflict.
if [[ "$py_rc" -eq 0 ]] && ! grep -Eq '^(<<<<<<< |=======|>>>>>>> )' "$file"; then
  git -C "$wt" add "$target"
fi
exit 0
