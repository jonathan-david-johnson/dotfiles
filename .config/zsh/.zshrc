# Shared across all machines. Machine-specific settings go in .zshrc.local (gitignored).

# --- History & options ------------------------------------------------------
ZSH_COMPDUMP="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/.zcompdump-${ZSH_VERSION}"
mkdir -p "${ZSH_COMPDUMP:h}"

# Oh My Zsh if present (runs compinit itself), else plain compinit
if [[ -d "$HOME/.oh-my-zsh" ]]; then
  export ZSH="$HOME/.oh-my-zsh"
  ZSH_THEME=""
  plugins=(git)
  source "$ZSH/oh-my-zsh.sh"
else
  autoload -Uz compinit
  compinit -d "$ZSH_COMPDUMP"
fi

HISTFILE="$HOME/.zsh_history"
HISTSIZE=32768
SAVEHIST=32768
setopt APPEND_HISTORY SHARE_HISTORY HIST_IGNORE_ALL_DUPS HIST_IGNORE_SPACE

# --- Key bindings -----------------------------------------------------------
bindkey -e
bindkey '^[[H' beginning-of-line '^[[F' end-of-line '^[[3~' delete-char
bindkey '^[[1;5C' forward-word '^[[1;5D' backward-word
bindkey '^[[A' history-search-backward '^[[B' history-search-forward

# --- Completion styles ------------------------------------------------------
command -v dircolors &>/dev/null && eval "$(dircolors -b)"
zstyle ':completion:*' auto-description 'specify: %d'
zstyle ':completion:*' completer _expand _complete _correct _approximate
zstyle ':completion:*' format 'Completing %d'
zstyle ':completion:*' group-name ''
zstyle ':completion:*' menu select=long
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*' list-prompt %SAt %p: Hit TAB for more, or the character to insert%s
zstyle ':completion:*' matcher-list '' 'm:{a-z}={A-Z}' 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=* l:|=*'
zstyle ':completion:*' select-prompt %SScrolling active: current selection at %p%s
zstyle ':completion:*' verbose true
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#)*=0=01;31'
zstyle ':completion:*:kill:*' command 'ps -u $USER -o pid,%cpu,tty,cputime,cmd'

# --- Omarchy (loaded before my aliases so mine win) -------------------------
if [[ -n "$OMARCHY_PATH" && -d "$OMARCHY_PATH/default/bash" ]]; then
  source "$OMARCHY_PATH/default/bash/envs"
  source "$OMARCHY_PATH/default/bash/aliases"
  for f in "$OMARCHY_PATH"/default/bash/fns/*(N); do source "$f"; done
  unset f
fi

# --- Tools ------------------------------------------------------------------
command -v mise &>/dev/null && eval "$(mise activate zsh)"

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
[[ -s "$NVM_DIR/bash_completion" ]] && source "$NVM_DIR/bash_completion"

command -v zoxide &>/dev/null && eval "$(zoxide init zsh)"
[[ ${TERM:-} != dumb ]] && command -v starship &>/dev/null && eval "$(starship init zsh)"
[[ -f "$XDG_CONFIG_HOME/fzf/fzf.zsh" ]] && source "$XDG_CONFIG_HOME/fzf/fzf.zsh"

# --- Aliases ----------------------------------------------------------------
if command -v eza &>/dev/null; then
  alias l='eza -la --icons --group-directories-first'
  alias lm='eza -la --icons --group-directories-first -s modified'
  alias ls='eza -la --icons --group-directories-first -s size'
  alias le='eza -la --icons --group-directories-first -s extension'
  alias lr='eza -la --icons --group-directories-first -r'
  alias lmr='eza -la --icons --group-directories-first -s modified -r'
  alias lsr='eza -la --icons --group-directories-first -s size -r'
  alias ler='eza -la --icons --group-directories-first -s extension -r'
  alias tree='eza --tree'
fi

alias c='claude --dangerously-skip-permissions'
alias cr='claude --dangerously-skip-permissions --resume'

alias pc='pi -c'
alias pic='pi -c'
alias pp='pi -r'

alias vi='nvim'

# --- Functions --------------------------------------------------------------
# herdr sessions: keep personal/work state isolated (separate socket + session.json)
# Bare `herdr` launches the personal session; any args pass through untouched.
herdr() {
  if [[ $# -eq 0 ]]; then
    command herdr --session personal
  else
    command herdr "$@"
  fi
}
alias herdrw='command herdr --session work'

# gamp: git add all → commit → push upstream
gamp() {
  git add --all && git commit -m "$1" && git push -u origin HEAD
}

# --- Machine-specific -------------------------------------------------------
[[ -f "$ZDOTDIR/.zshrc.local" ]] && source "$ZDOTDIR/.zshrc.local"

# --- Plugins (syntax-highlighting must be last) -----------------------------
for p in zsh-autosuggestions zsh-syntax-highlighting; do
  for d in /usr/share/zsh/plugins/$p /opt/homebrew/share/$p /usr/local/share/$p /usr/share/$p; do
    [[ -r "$d/$p.zsh" ]] && { source "$d/$p.zsh"; break; }
  done
done
unset p d
