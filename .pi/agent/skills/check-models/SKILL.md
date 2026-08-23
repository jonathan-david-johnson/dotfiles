---
name: check-models
description: Check and refresh which models the Agentic LLM Proxy actually serves, then update the pi provider model list and scoped (Ctrl+P / enabledModels) set. Use when models start returning 400 "Pricing not configured", after a proxy snapshot rotation, or when the user asks to refresh/verify available models, add new models, or fix the scoped model list.
---

# check-models

Verify which models the Agentic LLM Proxy currently serves and refresh pi's
config to match. The proxy exposes **no** `/models` endpoint and returns the
same `400 "Pricing not configured"` for both unpriced and nonexistent models,
so the only reliable signal is a live probe: **HTTP 200 = usable**.

This is a **propose-then-apply** workflow (never silently rewrite config):
1. probe, 2. show the user the findings + exact diffs, 3. apply only on confirm.

## What "available" means here

- Model list (the `pi.registerProvider(...)` `models` arrays in
  `agentic-llm-proxy-openai.ts`) = **every** model that probes 200.
- Scoped list (`enabledModels` in `settings.json`, used by Ctrl+P cycling and
  `/sm`) = **4 chat models**: best-reasoning + fast/cheap, per provider.
- Image / transcription / embedding models are **out of scope**: the proxy
  returns 404 for `/images/*`, `/audio/*`, `/embeddings`. The script still
  reports their status so you notice if that ever changes; only wire them up
  (as a separate provider) once an endpoint actually responds.

## Steps

Run everything against the **active** harness. The script auto-detects it from
`$PI_CODING_AGENT_DIR` (fallback `~/.pi/agent`) and edits that harness's
`extensions/agentic-llm-proxy-openai.ts` and `settings.json`.

1. **Preview candidates (free, no probing):**

   ```bash
   python3 scripts/check_models.py --dry-run
   ```

   Confirms which docs pages were reachable and lists the candidate ids (scraped
   from the official OpenAI + Claude model docs, unioned with currently-declared
   models). Report the candidate count to the user — each probe is one small
   billable API call.

2. **Probe (billable) and get a machine-readable report:**

   ```bash
   python3 scripts/check_models.py --json
   ```

   Key fields: `usable` (per provider), `proposed_model_list`, `model_list_add`,
   `model_list_now_dead`, `proposed_scope`, `aux_endpoints`. Use `--probe-all`
   to loosen the chat-family filter. Omit `--json` for a human-readable table.

3. **Propose diffs to the user.** Summarize:
   - new usable models to add, and now-dead declared models to drop;
   - the proposed scoped set (best + fast/cheap per provider);
   - any `review` rows (non-200, non-pricing) — flag as transient/uncertain,
     do not add them.

   Best-reasoning = highest family tier (major version dominates; e.g.
   `claude-opus-5` outranks `claude-opus-4-8`). Fast/cheap = cheapest tier
   (OpenAI `mini`/`nano`/`gpt-4o`; Anthropic `haiku` then `sonnet`). The user
   may override any pick.

4. **Apply on confirmation only.**

   Extension (`extensions/agentic-llm-proxy-openai.ts`):
   - Add an entry per newly-usable model; remove entries that are now dead.
   - **Preserve hand-tuned fields** on models that stay (`thinkingLevelMap`,
     `compat.forceAdaptiveThinking`, `compat.supportsTemperature`, custom
     `cost`, context/token limits). Never regenerate the whole file blindly.
   - For new models, mirror the closest existing sibling for `cost` constant,
     `contextWindow`, `maxTokens`, and `compat`. Cost constants live at the top
     of the file (`GPT5_COST`, `GPT4O_COST`, `OPUS_COST`, `SONNET_COST`,
     `HAIKU_COST`, ...). `compat` for brand-new families is best-effort — note
     the assumption so the user can correct it if adaptive-thinking calls fail.

   Settings (`settings.json`):
   - **Back up first**, then set `enabledModels` to the confirmed scoped set:

     ```bash
     cp settings.json "settings.json.bak.$(date +%Y%m%d-%H%M%S)"
     ```

     Write canonical `provider/id` entries (e.g. `openai/gpt-5.6-luna`).

5. **Verify** the edited extension still loads (no syntax error) before finishing,
   then tell the user to `/reload` so the new provider list and scope take effect.

## Notes

- The `/responses` (OpenAI) and `/v1/messages` (Anthropic) probes send
  `max_output_tokens: 16` / `max_tokens: 16` to minimize cost.
- Docs URLs and proxy base URLs are overridable via env
  (`CHECK_MODELS_OPENAI_DOCS`, `CHECK_MODELS_CLAUDE_DOCS`,
  `PI_OPENAI_PROXY_BASE_URL`, `PI_ANTHROPIC_PROXY_BASE_URL`). Auth is read from
  `PI_CODEX_AUTH_FILE` (fallback `~/.codex/auth.json`).
- Snapshots rotate server-side. Re-run this skill whenever a previously-working
  model starts returning 400.
