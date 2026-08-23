# Jira Links (piw) — investigation notes

Goal: in **piw only** (work pi, `PI_CODING_AGENT_DIR=~/.pi-toshiba/agent`), bare Jira
ticket keys in assistant output should stay visually as `ECGR-123` but be clickable,
opening `https://toshibaglobalcommerce.atlassian.net/browse/ECGR-123`.

Status: **not working in the live TUI.** Every offline test passes; the live render
shows plain, unlinked text. Instrumentation added, awaiting one live data point.

---

## 1. Design that was chosen

`pi.registerMarkdownTransformer()` (pi >= 0.84) rewrites the Markdown of user text,
assistant text and thinking blocks just before pi's built-in renderer runs. It is
display-only: the session `.jsonl` and the model context keep the raw text.

The transformer turns `ECGR-123` into `[ECGR-123](https://.../browse/ECGR-123)`.
pi-tui's Markdown renderer converts that to an OSC 8 hyperlink when the terminal
supports it, printing only the link text:

```
node_modules/@earendil-works/pi-tui/dist/components/markdown.js:529-547
  case "link":
    if (getCapabilities().hyperlinks) result += hyperlink(styledLink, token.href)
    else result += styledLink + linkUrl(` (${token.href})`)   // fallback
```

So on a hyperlink-capable terminal the transcript still reads `ECGR-123`, coloured
with the theme's `mdLink`; on a non-capable one it degrades to `ECGR-123 (https://...)`.

Relevant API facts confirmed in the docs and dist:

- `docs/extensions.md:1566` — `pi.registerMarkdownTransformer(transformer)`.
- Context passed: `messageType` (`user` | `assistant` | `assistant-thinking`),
  `isStreaming`, `availableWidth`.
- `docs/keybindings.md:89` — clicking an OSC 8 hyperlink in fullscreen TUI mode opens it.
- Transformers run in extension load order; a throwing transformer is swallowed and
  the chain continues.

## 2. The file

`~/.pi-toshiba/agent/extensions/jira-links.ts` (global extension for the work config
dir only, so personal pi in `~/.pi` never loads it).

Behaviour:

- Project keys whitelisted, longest-first so `ECGR` wins over `ECG`:
  `["ELERA", "ECGR", "ECG", "EBA"]`.
- Pattern: `\b(ELERA|ECGR|ECG|EBA)-(\d+)\b`.
- Masks protected spans before replacing, then restores them:
  fenced blocks ``` and ~~~, inline code, existing `[text](url)` and `[text][ref]`,
  `<...>` autolinks, bare `https?://...` URLs. Sentinel is `\uE000`.
- `if (isStreaming) return markdown;` — skips partial output.
- `if (messageType !== "assistant") return markdown;` — assistant text only
  (thinking blocks and the user's own typed messages are left alone, by request).
- Debug hook added during the investigation: set `PI_JIRA_LINKS_DEBUG=1` to append
  a trace to `/tmp/jira-links.log`.

## 3. What was verified to work (offline)

All of these passed:

1. **Regex behaviour**, 10 cases:
   - `ECGR-123`, `EBA-7` linked; `ECG-1` vs `ECGR-1` both correct.
   - untouched: inline code, fenced block interior, existing `[ECGR-5](...)` link,
     a bare `.../browse/ECGR-42` URL, `UTF-8`, `COVID-19`, `RFC-2119`,
     `ecgr-1`, `XECGR-1`, `ECGR-1a`.
2. **Module loads** under `node --experimental-strip-types`; default export is a function.
3. **pi's own loader** finds and binds it. Using
   `dist/core/extensions/loader.js: discoverAndLoadExtensions(packages, cwd, agentDir)`
   with the real work config dir, the real cwd and the five `settings.packages`
   entries: 0 errors, and `jira-links.ts -> markdownTransformer: true`.
   All other extensions report `false`, so there is no conflicting transformer.
4. **Full render pipeline**, driving the real `AssistantMessageComponent` with the
   transformer attached, emits exactly what is wanted:

```
\x1b]8;;https://toshibaglobalcommerce.atlassian.net/browse/ECGR-123\x1b\\
\x1b[38;2;129;162;190mECGR-123\x1b[39m\x1b]8;;\x1b\\
```

   Without the transformer the same message renders as plain `ECGR-123`.

## 4. What was ruled out

- **Wrong pi version.** `piw` is an alias in `~/.zshrc.local` that only sets
  `PI_CODING_AGENT_DIR`, `PI_CODEX_AUTH_FILE` and `REMOTE_PI_RELAY`, then runs the
  global `pi` = **0.84.1**, which has the API.
  A second, older copy exists at
  `~/.pi-toshiba/agent/npm/node_modules/@earendil-works/pi-coding-agent` = **0.79.10**
  (transitive dep of one of the `settings.packages`, and it has **no**
  `registerMarkdownTransformer`). `lsof` on the live pi shows native modules loaded
  from *both* trees, but `settings.json` `lastChangelogVersion: 0.84.1` was rewritten
  at 09:39 today by a piw launch, so the running app is 0.84.1.
  Still worth a sanity check if all else fails.
- **Terminal capability.** Ghostty is matched explicitly in
  `pi-tui/dist/terminal-image.js: detectCapabilities()` -> `hyperlinks: true`.
  Not tmux (tmux would need `set -ga terminal-features "*:hyperlinks"`).
  herdr's binary contains a full VT with hyperlink support
  (`CellData.hyperlink`, `full_render.visible_hyperlinks`), so it parses OSC 8.
  Also, if capability detection had returned false we would see the visible
  `ECGR-123 (https://...)` fallback, and we do not.
- **The text being tool output rather than assistant text.** Checked the session
  jsonl for the failing run
  (`~/.pi-toshiba/agent/sessions/--Users-jdj--/2026-08-17T16-39-03-419Z_01a01097-...jsonl`):
  the line is a genuine assistant text block,
  `"ECGR-123: CI-LP1-01 TLOG Databridge ACE Decoupling\n\nStatus: Open. ..."`.
- **Extension disabled by settings.** `settings.json` has no extension allow/deny list.
- **Load-order clash.** No other loaded extension registers a markdown transformer.

## 5. Evidence from the failing screenshot

Pixel-sampled the screenshot of the fresh piw session (`print ECGR-123`):

- rose-pine sets `mdLink: foam` = `#9ccfd8`.
- The `ECGR-123` glyphs are the same colour as the surrounding sentence
  (`200,208,243`), not foam.

Conclusion: the Markdown renderer never saw a link token for that text, i.e. the
transformed Markdown never reached the painted output.

## 6. Things tried in the live TUI (all failed)

- `/reload`, then looked at existing transcript — no change. Expected: transcript
  components capture the transformer list at construction time
  (`dist/modes/interactive/components/assistant-message.js:20-26`), and
  `interactive-mode.js:2875` only hands the fresh list to newly built components.
- Fresh piw session, new question mentioning `ECGR-123` — still no link.
- Terminal resize (forces re-render at a new `availableWidth`) — no change.

## 7. Leading hypothesis

The streamed lines are committed to scrollback as they stabilise, so the finalize
re-render cannot repaint them. Sequence in `dist/modes/interactive/interactive-mode.js`:

```
2539  new AssistantMessageComponent(..., getMarkdownTransformers())
2542/2549  updateContent(msg, true)    // per chunk, transform skipped by our guard
2586  message_end: updateContent(msg, false)   // transform would run here
```

If the text lines have already scrolled into static scrollback by the time line 2586
runs, the linkified version is computed but never painted. This single theory explains
all three failures: streaming, resize, and `/reload`.

## 8. Next step (pending)

Debug logging is already in the extension. Run in a piw pane:

```
rm -f /tmp/jira-links.log
PI_JIRA_LINKS_DEBUG=1 piw
# ask it to print a ticket key, then read /tmp/jira-links.log
```

Interpretation:

- **No file** — the extension is not loaded by that process at all. Re-check which
  binary runs (`0.79.10` vs `0.84.1`) and whether `PI_CODING_AGENT_DIR` is what we think.
- **Only `skip streaming ...` lines** — finalize never re-transforms; the fix is to
  stop skipping while streaming.
- **A `transform ... changed=true` line** — the transform ran and pi could not repaint
  the committed lines; the fix is again to linkify during streaming.

If the fix is "linkify during streaming", two guards are needed:

1. Do not linkify a match that ends at the very end of the buffer, since it may still
   be growing (`ECGR-12` -> `ECGR-123`).
2. While streaming, treat everything after an unclosed ``` fence as protected, since
   the code-block mask cannot see the closing fence yet.

## 9. Useful paths

```
extension        ~/.pi-toshiba/agent/extensions/jira-links.ts
work config dir  ~/.pi-toshiba/agent            (piw alias in ~/.zshrc.local)
theme            ~/.pi-toshiba/agent/themes/rose-pine.json   (mdLink: foam #9ccfd8)
pi install       ~/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent
docs             <pi install>/docs/extensions.md, docs/tui.md, docs/keybindings.md
markdown render  <pi install>/node_modules/@earendil-works/pi-tui/dist/components/markdown.js
capabilities     <pi install>/node_modules/@earendil-works/pi-tui/dist/terminal-image.js
```
