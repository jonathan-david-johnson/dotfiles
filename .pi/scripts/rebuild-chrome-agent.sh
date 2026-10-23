#!/usr/bin/env bash
# Rebuild ~/Applications/Chrome Agent.app from the installed Google Chrome.
#
# Why: agent-driven Chrome needs its own bundle ID (com.jdj.chrome-agent) so an
# AeroSpace rule can send it to workspace 9 without moving your own Chrome windows.
# Re-run after every Chrome update, or the profile (written by the newer Chrome)
# will be rejected by the older copy.
set -euo pipefail

SRC="/Applications/Google Chrome.app"
DST="$HOME/Applications/Chrome Agent.app"
PLIST="$DST/Contents/Info.plist"

if pgrep -f "$DST/Contents/MacOS" >/dev/null; then
  echo "Chrome Agent is running. Quit it (and pi's playwright session) first." >&2
  exit 1
fi

mkdir -p "$HOME/Applications"
rm -rf "$DST"
ditto "$SRC" "$DST"

/usr/libexec/PlistBuddy \
  -c "Set :CFBundleIdentifier com.jdj.chrome-agent" \
  -c "Set :CFBundleName Chrome Agent" \
  -c "Set :CFBundleDisplayName Chrome Agent" "$PLIST"
# Stop Google's updater from treating the copy as Chrome.
for k in KSProductID KSUpdateURL KSVersion KSChannelID; do
  /usr/libexec/PlistBuddy -c "Delete :$k" "$PLIST" 2>/dev/null || true
done
rm -f "$DST/Contents/embedded.provisionprofile"
xattr -cr "$DST"
codesign --force --deep --sign - "$DST"

echo "Built $DST ($("$DST/Contents/MacOS/Google Chrome" --version))"
