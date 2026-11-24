export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

# Omarchy: OMARCHY_PATH + PATH. No-op on machines without Omarchy.
[[ -r /usr/share/omarchy/default/bash/env-bootstrap ]] && source /usr/share/omarchy/default/bash/env-bootstrap

typeset -U path PATH
path+=("$HOME/.local/bin")
