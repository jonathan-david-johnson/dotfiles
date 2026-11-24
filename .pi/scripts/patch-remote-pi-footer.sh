#!/usr/bin/env bash
# Compact the remote-pi status bar into one segment. Re-run after remote-pi updates.
#   📡 5 🟢   peer count + relay dot (🟡 = relay waiting for pairing, no dot = relay off)
set -euo pipefail
F="$HOME/.pi/agent/npm/node_modules/remote-pi/dist/ui/footer.js"
[ -f "$F" ] || { echo "not found: $F" >&2; exit 1; }
if grep -q "compact-footer-patch" "$F"; then echo "already patched"; exit 0; fi
cp "$F" "$F.orig"
python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old_a = 'ctx.ui.setStatus(K_SESSION, `📡 ${state.session} (${count})`);'
new_a = ('{ /* compact-footer-patch */\n'
         '        const dot = state.relayOn ? (state.hasPairings ? " 🟢" : " 🟡") : "";\n'
         '        ctx.ui.setStatus(K_SESSION, `📡 ${count}${dot}`);\n'
         '    }')
old_b = 'ctx.ui.setStatus(K_RELAY, state.hasPairings ? "🟢 relay" : "🟡 relay waiting for pairing");'
new_b = 'ctx.ui.setStatus(K_RELAY, undefined);'
assert old_a in s and old_b in s, "footer.js layout changed; update patch"
s = s.replace(old_a, new_a).replace(old_b, new_b)
open(p, "w").write(s)
PY
echo "patched $F (backup: $F.orig)"
