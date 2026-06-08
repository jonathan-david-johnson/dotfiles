# Pi Config

My pi coding agent configuration. See [pi.dev](https://pi.dev).

This repo is the source of truth for `~/.pi/agent/` — clone it directly into `~/.pi`.

## Install on a new machine

```bash
# Install pi
npm install -g @earendil-works/pi-coding-agent

# Remove default ~/.pi if it exists
rm -rf ~/.pi

# Clone this repo directly as ~/.pi
git clone git@github.com:jonathan-david-johnson/.pi.git ~/.pi

# Auth (NOT in git — create manually)
echo '{"fireworks":{"type":"api_key","key":"YOUR_KEY"}}' > ~/.pi/agent/auth.json

# Packages
pi install npm:pi-web-access
pi install npm:@dreki-gg/pi-context7
```

## Updating config

```bash
cd ~/.pi && git pull
```

Changes take effect after `/reload` or restarting pi.
