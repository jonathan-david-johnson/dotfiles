#!/usr/bin/env python3
"""Claude Code statusline — pi-style token/cost/context badge.

Reads the statusLine JSON on stdin, parses the session transcript for the most
recent usage record, and renders:

  ~/dir  ↑<ctx> ↓<out>  R<remaining>  CH<cachehit>%  $<cost>  S<sess>% W<week>%  <pct>%/<window> (<model>) [CLEAR]

  ↑ctx   tokens sent this turn (input + cache_creation + cache_read) = live context size
  ↓out   cumulative output tokens this session
  R      remaining context before the window fills
  CH     cache-hit % of the last turn (cache_read / total input)
  $      session cost (from stdin)
  S      plan usage: 5-hour session window utilization %
  W      plan usage: 7-day weekly window utilization %
  pct    context used as % of the model window

Plan usage (S/W) comes from the /api/oauth/usage endpoint, cached to
.usage-cache.json with a 60s TTL. Rendering never blocks on the network:
a stale cache fires a detached background refresh (this script with
--refresh-usage) and the current render uses whatever the cache last held.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

USAGE_TTL = 60  # seconds before the plan-usage cache is refreshed
USAGE_URL = "https://api.anthropic.com/api/oauth/usage"


def cfg_dir():
    return os.environ.get("CLAUDE_CONFIG_DIR", os.path.join(os.path.expanduser("~"), ".claude"))


def usage_cache_path():
    return os.path.join(cfg_dir(), ".usage-cache.json")


def oauth_token():
    """Read the Claude Code OAuth access token: Keychain first, then file."""
    try:
        r = subprocess.run(
            ["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0 and r.stdout.strip():
            return json.loads(r.stdout)["claudeAiOauth"]["accessToken"]
    except Exception:
        pass
    try:
        with open(os.path.join(cfg_dir(), ".credentials.json")) as f:
            return json.load(f)["claudeAiOauth"]["accessToken"]
    except Exception:
        return None


def refresh_usage():
    """Fetch plan usage and atomically write it to the cache. Silent on failure."""
    tok = oauth_token()
    if not tok:
        return
    req = urllib.request.Request(USAGE_URL, headers={
        "Authorization": f"Bearer {tok}",
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.load(r)
    except Exception:
        return
    rec = {
        "s": (data.get("five_hour") or {}).get("utilization"),
        "w": (data.get("seven_day") or {}).get("utilization"),
        "ts": time.time(),
    }
    cache = usage_cache_path()
    try:
        tmp = cache + ".tmp"
        with open(tmp, "w") as f:
            json.dump(rec, f)
        os.replace(tmp, cache)
    except Exception:
        pass


def read_usage():
    """Return (session%, weekly%) from cache; fire a bg refresh if stale/missing."""
    s = w = None
    stale = True
    try:
        with open(usage_cache_path()) as f:
            d = json.load(f)
        s, w = d.get("s"), d.get("w")
        stale = (time.time() - d.get("ts", 0)) > USAGE_TTL
    except Exception:
        stale = True
    if stale:
        try:
            subprocess.Popen(
                [sys.executable, os.path.abspath(__file__), "--refresh-usage"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL, start_new_session=True,
            )
        except Exception:
            pass
    return s, w

C = "\033[38;5;244m"   # grey
A = "\033[38;5;172m"   # accent orange
G = "\033[38;5;71m"    # green (healthy)
Y = "\033[38;5;179m"   # amber
R = "\033[38;5;167m"   # red
Z = "\033[0m"


def human(n):
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.0f}k"
    return str(int(n))


def window_for(model_id, exceeds_200k):
    m = (model_id or "").lower()
    if "1m" in m or "[1m]" in m:
        return 1_000_000
    # Sonnet with the 1M beta reports exceeds_200k while under 1M.
    if exceeds_200k and "sonnet" in m:
        return 1_000_000
    return 200_000


def main():
    if "--refresh-usage" in sys.argv:
        refresh_usage()
        return

    try:
        d = json.load(sys.stdin)
    except Exception:
        d = {}

    cwd = d.get("workspace", {}).get("current_dir") or d.get("cwd") or os.getcwd()
    home = os.path.expanduser("~")
    disp = cwd.replace(home, "~") if cwd.startswith(home) else cwd
    # keep last two path segments to stay short
    parts = disp.rstrip("/").split("/")
    short = "/".join(parts[-2:]) if len(parts) > 2 else disp

    model = d.get("model", {})
    model_name = model.get("display_name") or model.get("id") or "?"
    effort = d.get("output_style", {}).get("effort") if isinstance(d.get("output_style"), dict) else None
    if not effort:
        effort = d.get("effort_level") or d.get("effortLevel")
    if not effort:
        cfg_dir = os.environ.get("CLAUDE_CONFIG_DIR", os.path.join(home, ".claude"))
        try:
            with open(os.path.join(cfg_dir, "settings.json")) as f:
                effort = json.load(f).get("effortLevel")
        except Exception:
            effort = None
    window = window_for(model.get("id"), d.get("exceeds_200k_tokens"))
    cost = (d.get("cost") or {}).get("total_cost_usd", 0.0)

    ctx = out = last_in = last_cr = last_cc = 0
    tp = d.get("transcript_path")
    if tp and os.path.isfile(tp):
        try:
            with open(tp, encoding="utf-8", errors="ignore") as f:
                for line in f:
                    try:
                        o = json.loads(line)
                    except Exception:
                        continue
                    u = (o.get("message") or {}).get("usage")
                    if not isinstance(u, dict):
                        continue
                    i = u.get("input_tokens", 0) or 0
                    cc = u.get("cache_creation_input_tokens", 0) or 0
                    cr = u.get("cache_read_input_tokens", 0) or 0
                    o_ = u.get("output_tokens", 0) or 0
                    out += o_
                    turn = i + cc + cr
                    if turn:  # remember the latest turn's context
                        ctx = turn
                        last_in, last_cr, last_cc = i, cr, cc
        except Exception:
            pass

    remaining = max(window - ctx, 0)
    pct = (ctx / window * 100) if window else 0
    tot_in = last_in + last_cr + last_cc
    ch = (last_cr / tot_in * 100) if tot_in else 0

    pcol = G if pct < 60 else (Y if pct < 85 else R)

    def ucol(v):
        return G if v < 60 else (Y if v < 85 else R)

    sess, week = read_usage()

    seg = [
        f"{C}{short}{Z}",
        f"{C}↑{human(ctx)} ↓{human(out)}{Z}",
        f"{C}R{human(remaining)}{Z}",
        f"{C}CH{ch:.0f}%{Z}",
        f"{C}${cost:.3f}{Z}",
    ]
    if sess is not None or week is not None:
        s_txt = f"{ucol(sess)}S{sess:.0f}%{Z}" if sess is not None else ""
        w_txt = f"{ucol(week)}W{week:.0f}%{Z}" if week is not None else ""
        seg.append(" ".join(t for t in (s_txt, w_txt) if t))
    seg += [
        f"{pcol}{pct:.1f}%/{human(window)}{Z}",
        f"{C}({model_name}{'|' + effort if effort else ''}){Z}",
    ]
    out_str = "  ".join(seg)

    # clear mode badge suffix
    flag = os.path.join(os.environ.get("CLAUDE_CONFIG_DIR", os.path.join(home, ".claude")), ".clarity-mode")
    mode = "on"
    if os.path.isfile(flag) and not os.path.islink(flag):
        try:
            with open(flag, "rb") as f:
                mode = re.sub(rb"[^a-z]", b"", f.read(16).lower()).decode()
        except Exception:
            mode = "on"
    if mode != "off":
        out_str += f"  {A}[CLEAR]{Z}"

    sys.stdout.write(out_str)


if __name__ == "__main__":
    main()
