# Agents

You are located in my `.pi` configuration directory. This directory is backed up to GitHub for version control and safety.

## The `pi` executable

`pi` is the nvm global bin, `~/.nvm/versions/node/v24.15.0/bin/pi`. It links to
the global package `@earendil-works/pi-coding-agent`, and that package is itself
a symlink to a build slot at
`~/.cache/pi-safe-upgrade/build-<version>-<stamp>/packages/coding-agent`.

`pi_safe_upgrade --execute` builds a new slot from the source checkout at
`~/.cache/pi-mono-tool-groups`, then repoints the global package link. It keeps
the live slot and the previous one (the rollback target) and deletes older ones.
Restart open pi sessions after an upgrade.

`pi_update` is the older in-place rebuild of the source checkout. The running
`pi` does not use that checkout directly anymore, so do not use `pi_update` to
upgrade pi.

## Todo

Open work is tracked in [todo.md](todo.md). Supplemental detail for individual items lives in its own file, linked from the todo entry.

## Theme

Colors come from three layers: Ghostty, Herdr, and pi. Ghostty has two config
files, and the second one overrides the first. See [theme.md](theme.md) for the
setup, the diagnostic script, and the known failure modes.

## Custom extensions

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
