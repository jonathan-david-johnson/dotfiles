# Pi Config

My pi coding agent configuration. See [pi.dev](https://pi.dev).

## Install on a new machine

```bash
# Install pi
npm install -g @earendil-works/pi-coding-agent

# Clone config
mkdir -p ~/.pi/agent
cp settings.json ~/.pi/agent/
cp models.json ~/.pi/agent/
cp -r extensions ~/.pi/agent/
cp -r themes ~/.pi/agent/
cp -r agents ~/.pi/agent/
cp -r skills ~/.pi/agent/

# Auth (NOT in git — create manually)
echo '{"fireworks":{"type":"api_key","key":"YOUR_KEY"}}' > ~/.pi/agent/auth.json

# Packages
pi install npm:pi-web-access
```
