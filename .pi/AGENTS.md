# Agents

You are located in my `.pi` configuration directory. This directory is backed up to GitHub for version control and safety.

Additionally, I maintain a separate `~/pi-experiments` directory for experiments, testing, and troubleshooting issues that arise during development.

This pi agent uses fireworks.ai and openrouter  open weight models only

I have a separate 'piw'  (check alais) for my work account that goes through an LLM proxy to use openai and anthropic models.

## Todo

Open work is tracked in [todo.md](todo.md). Supplemental detail for individual items lives in its own file, linked from the todo entry.

## Skills we don't vendor

- **firecrawl** — CLI-scaffolded, not hand-written. Run `firecrawl setup skills` to
  (re)install the firecrawl skill set on a machine when needed.
- **context7** — comes from the `npm:@dreki-gg/pi-context7` package already listed in
  `agent/settings.json` packages; no separate skill copy needed.
