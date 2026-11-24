# Pi Config

My pi coding agent configuration. See [pi.dev](https://pi.dev).

This directory is the source of truth for the tracked parts of `~/.pi/agent/`. `install.sh` at the dotfiles root links them in. `~/.pi/agent` itself stays a real directory, because pi keeps auth, sessions, and package installs there, and Omarchy adds its own skills and theme.

## What `install.sh` does

| Item | How |
|---|---|
| `models.json`, `mcp.json`, `agents/`, `extensions/`, `prompts/`, `supi/config.json` | Linked whole |
| `skills/*`, `themes/*` | Each entry linked separately, so other tools can add their own |
| Matt Pocock skills (grill-with-docs, handoff, improve-codebase-architecture, tdd) | Linked from a clone at `~/code/mattpocock/skills` (cloned if missing) |
| `settings.json` | Merged, not linked: existing file, then `agent/settings.json` (shared), then `agent/settings.local.json` (this machine, gitignored) |

Put per-machine settings (`theme`, `defaultModel`, `hideThinkingBlock`) in `agent/settings.local.json`. Settings changed from inside pi stay on that machine; copy them into `agent/settings.json` to share them.

Packages in `settings.json` (pi-clarity, supi-code-intelligence, context7, remote-pi) install automatically on first start.

## New machine

1. Install pi, then run `./install.sh` from the dotfiles root.
2. Run `/login` for each provider and `/mcp` to sign in to MCP servers. Credentials are per machine and not in git.
3. Install the language servers for supi-code-intelligence: `mise install` (see `.config/mise/config.toml`). Java needs a JDK 21+ and `jdtls` from the OS package manager.

## Updating config

Pull the dotfiles repo and re-run `./install.sh`. Changes take effect after `/reload` or restarting pi.
