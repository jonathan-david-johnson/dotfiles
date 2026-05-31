# Pi Config

My pi coding agent configuration. See [pi.dev](https://pi.dev).

## Install on a new machine

```bash
# Install pi
npm install -g @earendil-works/pi-coding-agent

# Clone to a permanent location
mkdir -p ~/src
git clone git@github.com:jonathan-david-johnson/pi-config.git ~/src/pi-config

# Symlink config files into ~/.pi/agent (remove existing first if present)
ln -sf ~/src/pi-config/settings.json ~/.pi/agent/settings.json
ln -sf ~/src/pi-config/models.json ~/.pi/agent/models.json
ln -sf ~/src/pi-config/extensions ~/.pi/agent/extensions
ln -sf ~/src/pi-config/themes ~/.pi/agent/themes
ln -sf ~/src/pi-config/agents ~/.pi/agent/agents
ln -sf ~/src/pi-config/skills ~/.pi/agent/skills

# Auth (NOT in git — create manually)
echo '{"fireworks":{"type":"api_key","key":"YOUR_KEY"}}' > ~/.pi/agent/auth.json

# Packages
pi install npm:pi-web-access
```

## Updating config

```bash
cd ~/src/pi-config && git pull
```

Changes take effect after `/reload` or restarting pi.
