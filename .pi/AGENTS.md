# Agents

You are located in my `.pi` configuration directory. This directory is backed up to GitHub for version control and safety.

The `choose-model` skill lives in its own repo at `~/choose-model` (github.com/jonathan-david-johnson/choose-model) and is symlinked into `agent/skills/`.

## Models

Personal pi defaults to `openai-codex` (ChatGPT Plus oauth) — see
`defaultModel` in [agent/settings.json](agent/settings.json). Fireworks and
openrouter supply the open-weight models.

`piw` (see the alias) is the work account; it reaches openai and anthropic
through an LLM proxy. Never point personal pi at the work proxy.

Both aliases run the same executable, which is a symlink into a local monorepo
checkout at `~/.cache/pi-mono-tool-groups`. `pi_update` rebuilds it in place, so
restart open sessions afterwards — a session spanning a rebuild fails with
`The requested module './text.js' does not provide an export named ...`.

## Todo

Open work is tracked in [todo.md](todo.md). Supplemental detail for individual items lives in its own file, linked from the todo entry.

## Vendored extensions

- **subscription-guard** ([agent/extensions/subscription-guard.ts](agent/extensions/subscription-guard.ts))
  — copied from the `pi-claude-subscription-connector` package so Claude OAuth
  requests keep billing to the subscription (not "extra usage"). We vendor it to
  drop that package's `usage-status.ts` 🧠 footer while keeping the billing guard.
  Re-sync on connector updates: `npm i pi-claude-subscription-connector` (ad-hoc),
  `cp .../extensions/subscription-guard.ts agent/extensions/`, re-apply the file's
  header. The `pi-claude-subscription-connector` package is intentionally NOT in
  `agent/settings.json` packages.
- **subscription-usage** ([agent/extensions/subscription-usage.ts](agent/extensions/subscription-usage.ts))
  — hand-written replacement for the connector's footer line: a brain-free usage
  status (`5h 8% (2h30m) · wk 17% (3d4h)`, plus model-scoped weekly) for OAuth
  subscription providers (`anthropic`, `openai-codex`). Per-token/API-key models
  fall back to pi's default footer. OpenAI usage comes from the same endpoint as
  `~/Documents/bin/usage` (`chatgpt.com/backend-api/wham/usage`).

## Skills we don't vendor

- **firecrawl** — CLI-scaffolded, not hand-written. Run `firecrawl setup skills` to
  (re)install the firecrawl skill set on a machine when needed.
- **context7** — comes from the `npm:@dreki-gg/pi-context7` package already listed in
  `agent/settings.json` packages; no separate skill copy needed.
