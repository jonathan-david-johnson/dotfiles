# Pi Config

My pi coding agent configuration. See [pi.dev](https://pi.dev).

This directory is the source of truth for `~/.pi/agent/` and lives inside the main dotfiles repo.

## Install on a new machine

```bash
# Install pi
npm install -g @earendil-works/pi-coding-agent

# Remove default ~/.pi if it exists
rm -rf ~/.pi

# Clone dotfiles and symlink the bundled Pi config
mkdir -p ~/code/jonathan-david-johnson
git clone git@github.com:jonathan-david-johnson/dotfiles.git ~/code/jonathan-david-johnson/dotfiles
ln -s ~/code/jonathan-david-johnson/dotfiles/.pi ~/.pi

# Auth (NOT in git — create manually)
echo '{"fireworks":{"type":"api_key","key":"YOUR_KEY"}}' > ~/.pi/agent/auth.json

# Packages
pi install npm:pi-web-access
pi install npm:@dreki-gg/pi-context7
```

## Updating config

```bash
cd ~/code/jonathan-david-johnson/dotfiles && git pull
```

Changes take effect after `/reload` or restarting pi.
