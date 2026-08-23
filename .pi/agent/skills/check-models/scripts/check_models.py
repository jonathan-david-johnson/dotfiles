#!/usr/bin/env python3
"""
check-models: discover + verify which models the Agentic LLM Proxy actually
serves, and propose model-list / scoped-list updates.

Read-only. This script never edits config. It probes and reports; the agent
running the skill proposes diffs and applies them only after user confirmation.

Discovery: scrape official model docs for candidate IDs (the proxy exposes no
/models endpoint). Verification: POST a tiny request per candidate.
  200                         -> usable (real + priced)
  400 "Pricing not configured"-> dead   (unpriced OR nonexistent; proxy can't tell)
  404                         -> endpoint not routed
  other                       -> review

Usage:
  check_models.py --dry-run          # list candidates + counts, no probing (free)
  check_models.py                    # probe, print human report
  check_models.py --json             # probe, emit machine-readable JSON
  check_models.py --probe-all        # probe every scraped candidate (looser filter)
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error

# --- Config (override via env) ---------------------------------------------
OPENAI_BASE = os.environ.get(
    "PI_OPENAI_PROXY_BASE_URL",
    "https://openai.llm-proxy.toshiba-agentic-sandbox.net/v1",
).rstrip("/")
ANTHROPIC_BASE = os.environ.get(
    "PI_ANTHROPIC_PROXY_BASE_URL",
    "https://anthropic.llm-proxy.toshiba-agentic-sandbox.net",
).rstrip("/")
POP_TOKEN = os.environ.get("PI_POP_PROXY_TOKEN")

OPENAI_DOCS = os.environ.get("CHECK_MODELS_OPENAI_DOCS", "https://developers.openai.com/api/docs/models")
CLAUDE_DOCS = os.environ.get("CHECK_MODELS_CLAUDE_DOCS", "https://platform.claude.com/docs/en/about-claude/models/overview")

AGENT_DIR = os.path.expanduser(
    os.environ.get("PI_CODING_AGENT_DIR", os.path.join("~", ".pi", "agent"))
)
EXT_PATH = os.path.join(AGENT_DIR, "extensions", "agentic-llm-proxy-openai.ts")
SETTINGS_PATH = os.path.join(AGENT_DIR, "settings.json")

# Endpoints to check for availability (image/transcription/etc.).
AUX_ENDPOINTS = [
    "/images/generations",
    "/audio/transcriptions",
    "/audio/speech",
    "/embeddings",
]

NON_CHAT = re.compile(r"(tts|transcribe|realtime|audio|image|embedding|moderation|search|dall-?e)", re.I)
TIMEOUT = 30


def read_key():
    path = os.environ.get("PI_CODEX_AUTH_FILE") or os.path.expanduser("~/.codex/auth.json")
    try:
        with open(path) as f:
            return json.load(f).get("OPENAI_API_KEY") or ""
    except Exception:
        return ""


def http(url, method="GET", headers=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def fetch(url):
    status, text = http(url, headers={"User-Agent": "Mozilla/5.0"})
    return text if status == 200 else ""


# --- Candidate discovery ----------------------------------------------------

def normalize_openai(mid):
    mid = mid.lower()
    # gpt-5-4 -> gpt-5.4 (numeric minor only; keep gpt-5-mini/nano/codex as-is)
    m = re.match(r"^gpt-5-(\d+)$", mid)
    if m:
        return f"gpt-5.{m.group(1)}"
    return mid


def scrape_openai(html):
    ids = re.findall(r"gpt-[0-9][a-z0-9.\-]*", html, re.I)
    out = set()
    for raw in ids:
        mid = re.sub(r"\.(jpg|jpeg|png|webp|svg|js)$", "", raw, flags=re.I).lower()
        if NON_CHAT.search(mid):
            continue
        if mid.endswith("-"):
            continue
        out.add(normalize_openai(mid))
    return out


def scrape_claude(html):
    ids = re.findall(r"claude-(?:opus|sonnet|haiku)-[0-9][a-z0-9\-]*", html, re.I)
    out = set()
    for raw in ids:
        mid = raw.lower()
        mid = re.sub(r"-v\d+$", "", mid)                 # drop -v1
        if "introductory-pricing" in mid or "-to-" in mid:
            continue
        out.add(mid)
    return out


def declared_models():
    """Parse currently-declared model ids per provider from the extension."""
    try:
        text = open(EXT_PATH).read()
    except Exception:
        return {"openai": [], "anthropic": []}
    oi = text.find('registerProvider("openai"')
    ai = text.find('registerProvider("anthropic"')
    if oi < 0:
        oi = 0
    if ai < 0:
        ai = len(text)
    openai_ids = re.findall(r'id:\s*"([^"]+)"', text[oi:ai])
    anth_ids = re.findall(r'id:\s*"([^"]+)"', text[ai:])
    return {"openai": openai_ids, "anthropic": anth_ids}


def enabled_models():
    try:
        return json.load(open(SETTINGS_PATH)).get("enabledModels") or []
    except Exception:
        return []


# --- Probing ----------------------------------------------------------------

def classify(status, text):
    if status == 200:
        return "usable"
    if status == 400 and "Pricing not configured" in text:
        return "dead"
    if status == 404:
        return "notrouted"
    return "review"


def probe_openai(key, mid):
    status, text = http(
        f"{OPENAI_BASE}/responses",
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 **({"X-Pop-Proxy-Token": POP_TOKEN} if POP_TOKEN else {})},
        body={"model": mid, "input": "ping", "max_output_tokens": 16},
    )
    return classify(status, text), status


def probe_anthropic(key, mid):
    user = os.environ.get("USER") or "pi"
    status, text = http(
        f"{ANTHROPIC_BASE}/v1/messages",
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "anthropic-version": "2023-06-01", "x-auth-request-user": user},
        body={"model": mid, "max_tokens": 16, "messages": [{"role": "user", "content": "ping"}]},
    )
    return classify(status, text), status


# --- Scoped-set ranking -----------------------------------------------------

def openai_best_score(mid):
    m = re.match(r"^gpt-5(?:\.(\d+))?", mid)
    ver = float("5." + m.group(1)) if (m and m.group(1)) else 5.0
    if re.search(r"(mini|nano)", mid):
        ver -= 10  # small models rank low for "best reasoning"
    return ver


def openai_cheap_score(mid):
    # Lower = cheaper/faster preferred.
    if "nano" in mid:
        return 0
    if "mini" in mid:
        return 1
    m = re.match(r"^gpt-5(?:\.(\d+))?", mid)
    ver = float("5." + m.group(1)) if (m and m.group(1)) else 5.0
    return 10 + ver


def anthropic_base_rank(mid):
    return {"opus": 300, "sonnet": 200, "haiku": 100}.get(
        re.search(r"claude-(opus|sonnet|haiku)", mid).group(1), 0
    )


def anthropic_family_ver(mid):
    """Family version components only (e.g. 4-8 -> (4,8)); ignore date snapshots."""
    tail = re.sub(r"^claude-(opus|sonnet|haiku)-", "", mid)
    parts = []
    for p in tail.split("-"):
        if p.isdigit() and len(p) < 7:   # stop at date-like YYYYMMDD
            parts.append(int(p))
        else:
            break
    return tuple(parts) or (0,)


def _ver_weight(mid):
    v = anthropic_family_ver(mid)
    major = v[0]
    minor = v[1] if len(v) > 1 else 0
    return major + minor * 0.1


def anthropic_best_score(mid):
    # base tier dominates, then family version (major, then minor).
    return anthropic_base_rank(mid) + _ver_weight(mid)


def anthropic_cheap_score(mid):
    # haiku cheapest, then sonnet, then opus; newer within a tier costs a hair more.
    return anthropic_base_rank(mid) + _ver_weight(mid) * 0.01


def pick_scoped(usable_openai, usable_anth, current_scope):
    """Best-reasoning + fast/cheap per provider. Prefer snapshots over bare aliases."""
    def choose(ids, best_key, cheap_key):
        if not ids:
            return []
        best = max(ids, key=best_key)
        cheap_pool = [m for m in ids if m != best]
        cheap = min(cheap_pool, key=cheap_key) if cheap_pool else None
        out = [best] + ([cheap] if cheap else [])
        return out

    oi = choose(usable_openai, openai_best_score, openai_cheap_score)
    an = choose(usable_anth, anthropic_best_score, anthropic_cheap_score)
    scoped = [f"openai/{m}" for m in oi] + [f"anthropic/{m}" for m in an]
    # Keep stable order; dedupe.
    seen, final = set(), []
    for m in scoped:
        if m not in seen:
            seen.add(m)
            final.append(m)
    return final


# --- Main -------------------------------------------------------------------

def main():
    args = set(sys.argv[1:])
    dry = "--dry-run" in args
    as_json = "--json" in args
    probe_all = "--probe-all" in args

    key = read_key()
    decl = declared_models()
    scope = enabled_models()

    oi_html = fetch(OPENAI_DOCS)
    cl_html = fetch(CLAUDE_DOCS)
    scraped_oi = scrape_openai(oi_html)
    scraped_cl = scrape_claude(cl_html)

    cand_oi = sorted(set(decl["openai"]) | scraped_oi)
    cand_an = sorted(set(decl["anthropic"]) | scraped_cl)

    if not probe_all:
        # Keep chat-family candidates only (already filtered on scrape; declared kept).
        cand_oi = [m for m in cand_oi if not NON_CHAT.search(m)]

    report = {
        "agent_dir": AGENT_DIR,
        "extension": EXT_PATH,
        "settings": SETTINGS_PATH,
        "docs": {"openai": bool(oi_html), "claude": bool(cl_html)},
        "candidates": {"openai": cand_oi, "anthropic": cand_an,
                       "count": len(cand_oi) + len(cand_an)},
        "current_scope": scope,
    }

    if dry:
        if as_json:
            print(json.dumps(report, indent=2))
        else:
            print(f"Agent dir : {AGENT_DIR}")
            print(f"Extension : {EXT_PATH}")
            print(f"Docs fetched: openai={bool(oi_html)} claude={bool(cl_html)}")
            print(f"\nCandidates to probe ({report['candidates']['count']} billable calls):")
            print("  openai   :", ", ".join(cand_oi))
            print("  anthropic:", ", ".join(cand_an))
            print("\n(no probing performed; re-run without --dry-run to verify)")
        return

    if not key:
        print("ERROR: no OPENAI_API_KEY found (check PI_CODEX_AUTH_FILE / ~/.codex/auth.json)", file=sys.stderr)
        sys.exit(1)

    results = {"openai": {}, "anthropic": {}}
    for m in cand_oi:
        results["openai"][m], _ = probe_openai(key, m)
    for m in cand_an:
        results["anthropic"][m], _ = probe_anthropic(key, m)

    aux = {}
    for ep in AUX_ENDPOINTS:
        status, _ = http(f"{OPENAI_BASE}{ep}", method="POST",
                         headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                         body={})
        aux[ep] = ("available" if status not in (0, 404) else "not-routed", status)

    usable_oi = sorted([m for m, v in results["openai"].items() if v == "usable"])
    usable_an = sorted([m for m, v in results["anthropic"].items() if v == "usable"])

    declared_all = {f"openai/{m}" for m in decl["openai"]} | {f"anthropic/{m}" for m in decl["anthropic"]}
    usable_all = {f"openai/{m}" for m in usable_oi} | {f"anthropic/{m}" for m in usable_an}

    proposed_model_list = sorted(usable_all)
    add = sorted(usable_all - declared_all)
    now_dead = sorted(declared_all - usable_all)  # declared but no longer usable
    proposed_scope = pick_scoped(usable_oi, usable_an, scope)

    report.update({
        "results": results,
        "aux_endpoints": aux,
        "usable": {"openai": usable_oi, "anthropic": usable_an},
        "proposed_model_list": proposed_model_list,
        "model_list_add": add,
        "model_list_now_dead": now_dead,
        "proposed_scope": proposed_scope,
    })

    if as_json:
        print(json.dumps(report, indent=2))
        return

    def table(provider, res):
        print(f"\n{provider}:")
        for m in sorted(res):
            print(f"  {res[m]:9s}  {m}")

    print(f"Agent dir : {AGENT_DIR}")
    table("openai", results["openai"])
    table("anthropic", results["anthropic"])
    print("\nAux endpoints (image/transcription/etc.):")
    for ep, (label, code) in aux.items():
        print(f"  {label:11s} {code}  {ep}")
    print("\n--- Proposed model list (everything usable) ---")
    for m in proposed_model_list:
        print("  " + m)
    if add:
        print("\n  + to add   :", ", ".join(add))
    if now_dead:
        print("  - now dead :", ", ".join(now_dead))
    print("\n--- Proposed scoped set (best + fast/cheap per provider) ---")
    for m in proposed_scope:
        print("  " + m)
    print("\ncurrent scope:", ", ".join(scope) or "(none)")


if __name__ == "__main__":
    main()
