# Pi Config

My pi coding agent configuration. See [pi.dev](https://pi.dev).

This repo is the source of truth for `~/.pi/agent/` on this machine — all config
files are symlinked from this repo into `~/.pi/agent/`.

## Install on a new machine

```bash
# Install pi
npm install -g @earendil-works/pi-coding-agent

# Clone to a permanent location
git clone git@github.com:jonathan-david-johnson/pi-config.git ~/pi-config

# Remove default config files/dirs from ~/.pi/agent (keep auth.json, sessions/, npm/, bin/)
rm -rf ~/.pi/agent/skills ~/.pi/agent/themes ~/.pi/agent/agents \
       ~/.pi/agent/extensions ~/.pi/agent/models.json ~/.pi/agent/settings.json

# Symlink config files from the repo into ~/.pi/agent
ln -s ~/pi-config/settings.json ~/.pi/agent/settings.json
ln -s ~/pi-config/models.json ~/.pi/agent/models.json
ln -s ~/pi-config/extensions ~/.pi/agent/extensions
ln -s ~/pi-config/themes ~/.pi/agent/themes
ln -s ~/pi-config/agents ~/.pi/agent/agents
ln -s ~/pi-config/skills ~/.pi/agent/skills

# Auth (NOT in git — create manually)
echo '{"fireworks":{"type":"api_key","key":"YOUR_KEY"}}' > ~/.pi/agent/auth.json

# Packages
pi install npm:pi-web-access
```

## Updating config

```bash
cd ~/pi-config && git pull
```

Changes take effect after `/reload` or restarting pi.
