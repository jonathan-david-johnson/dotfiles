# Oh My Zsh if present, else bare zsh init
if [[ -d "$HOME/.oh-my-zsh" ]]; then
  export ZSH="$HOME/.oh-my-zsh"
  ZSH_THEME=""
  plugins=(git)
  source $ZSH/oh-my-zsh.sh
else
  setopt histignorealldups sharehistory
  bindkey -e
  HISTSIZE=1000
  SAVEHIST=1000
  HISTFILE=~/.zsh_history
  autoload -Uz compinit
  compinit
fi

# Tab completions
zstyle ':completion:*' auto-description 'specify: %d'
zstyle ':completion:*' completer _expand _complete _correct _approximate
zstyle ':completion:*' format 'Completing %d'
zstyle ':completion:*' group-name ''
zstyle ':completion:*' menu select=2
[[ "$(uname)" != "Darwin" ]] && eval "$(dircolors -b)"
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*' list-colors ''
zstyle ':completion:*' list-prompt %SAt %p: Hit TAB for more, or the character to insert%s
zstyle ':completion:*' matcher-list '' 'm:{a-z}={A-Z}' 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=* l:|=*'
zstyle ':completion:*' menu select=long
zstyle ':completion:*' select-prompt %SScrolling active: current selection at %p%s
zstyle ':completion:*' use-compctl false
zstyle ':completion:*' verbose true
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#)*=0=01;31'
zstyle ':completion:*:kill:*' command 'ps -u $USER -o pid,%cpu,tty,cputime,cmd'

alias l='eza -la --icons --group-directories-first '
alias lm='eza -la --icons --group-directories-first -s modified'
alias ls='eza -la --icons --group-directories-first -s size'
alias le='eza -la --icons --group-directories-first -s extension'
alias lr='eza -la --icons --group-directories-first  -r'
alias lmr='eza -la --icons --group-directories-first -s modified -r'
alias lsr='eza -la --icons --group-directories-first -s size -r'
alias ler='eza -la --icons --group-directories-first -s extension -r'
alias tree="eza --tree"

eval "$(starship init zsh)"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

alias c='claude --dangerously-skip-permissions'
alias cr='claude --dangerously-skip-permissions --resume'

alias pc='pi -c'
alias pp='pi -r'

alias vi='nvim'

# herdr sessions: keep personal/work state isolated (separate socket + session.json)
# Bare `herdr` launches the personal session; any args (subcommands/flags) pass
# through to the real binary untouched. `command herdr` bypasses this function,
# so there is no shell recursion.
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

[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

