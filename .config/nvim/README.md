# nvim config

A modern Neovim setup built around LSP, Telescope, and lazy-loaded plugins. Targets TypeScript/JavaScript, Python, and Java workflows but is easy to extend.

## Requirements

- [Neovim](https://neovim.io/) >= 0.10
- [git](https://git-scm.com/)
- [Nerd Font](https://www.nerdfonts.com/) (for icons)
- `make` (for telescope-fzf-native)
- Language-specific tooling (see [Formatters](#formatters) below)

## Structure

```
~/.config/nvim/
├── init.lua                    # Entry point
└── lua/jjohnson/
    ├── core/
    │   ├── options.lua         # Vim options
    │   └── keymaps.lua         # Core keymaps
    ├── lazy.lua                # Plugin manager bootstrap
    └── plugins/
        ├── lsp/
        │   ├── mason.lua       # LSP installer
        │   └── lspconfig.lua   # LSP server configs
        └── *.lua               # One file per plugin
```

## Plugins

### Core
| Plugin | Purpose |
|--------|---------|
| [lazy.nvim](https://github.com/folke/lazy.nvim) | Plugin manager |
| [plenary.nvim](https://github.com/nvim-lua/plenary.nvim) | Lua utilities (dep) |
| [nvim-web-devicons](https://github.com/nvim-tree/nvim-web-devicons) | File icons |

### UI
| Plugin | Purpose |
|--------|---------|
| [catppuccin](https://github.com/catppuccin/nvim) | Colorscheme (auto light/dark based on OS) |
| [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim) | Status line |
| [bufferline.nvim](https://github.com/akinsho/bufferline.nvim) | Buffer tabs |
| [alpha-nvim](https://github.com/goolord/alpha-nvim) | Start screen |
| [indent-blankline.nvim](https://github.com/lukas-reineke/indent-blankline.nvim) | Indent guides |
| [dressing.nvim](https://github.com/stevearc/dressing.nvim) | Better UI inputs |

### Navigation
| Plugin | Purpose |
|--------|---------|
| [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) | Fuzzy finder |
| [nvim-tree.lua](https://github.com/nvim-tree/nvim-tree.lua) | File explorer |
| [vim-tmux-navigator](https://github.com/christoomey/vim-tmux-navigator) | Seamless tmux/nvim pane navigation |
| [vim-maximizer](https://github.com/szw/vim-maximizer) | Toggle maximize split |
| [auto-session](https://github.com/rmagatti/auto-session) | Session persistence |

### LSP & Completion
| Plugin | Purpose |
|--------|---------|
| [mason.nvim](https://github.com/williamboman/mason.nvim) | LSP/formatter installer |
| [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) | LSP configuration |
| [nvim-cmp](https://github.com/hrsh7th/nvim-cmp) | Autocompletion |
| [LuaSnip](https://github.com/L3MON4D3/LuaSnip) | Snippet engine |
| [friendly-snippets](https://github.com/rafamadriz/friendly-snippets) | Snippet collection |

### Editing
| Plugin | Purpose |
|--------|---------|
| [conform.nvim](https://github.com/stevearc/conform.nvim) | Code formatting |
| [Comment.nvim](https://github.com/numToStr/Comment.nvim) | Smart commenting |
| [nvim-autopairs](https://github.com/windwp/nvim-autopairs) | Auto bracket/quote pairs |
| [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) | Syntax highlighting & text objects |
| [todo-comments.nvim](https://github.com/folke/todo-comments.nvim) | Highlighted TODO/FIXME/HACK comments |
| [render-markdown.nvim](https://github.com/MeanderingProgrammer/render-markdown.nvim) | Markdown preview in buffer |

### Git
| Plugin | Purpose |
|--------|---------|
| [gitsigns.nvim](https://github.com/lewis6991/gitsigns.nvim) | Git decorations in gutter |

### Database
| Plugin | Purpose |
|--------|---------|
| [vim-dadbod](https://github.com/tpope/vim-dadbod) | Database client |
| [vim-dadbod-ui](https://github.com/kristijanhusak/vim-dadbod-ui) | Database UI |
| [vim-dadbod-completion](https://github.com/kristijanhusak/vim-dadbod-completion) | SQL completion |

### AI
| Plugin | Purpose |
|--------|---------|
| [claude-code.nvim](https://github.com/greggh/claude-code.nvim) | Claude Code terminal integration |

## LSP Servers

Installed automatically via Mason:

| Server | Language |
|--------|---------|
| `ts_ls` | TypeScript / JavaScript |
| `pyright` | Python |
| `jdtls` | Java |
| `jsonls` | JSON |
| `yamlls` | YAML |
| `dockerls` | Dockerfile |
| `markdown_oxide` | Markdown |

To add more servers, add them to `ensure_installed` in `lua/jjohnson/plugins/lsp/mason.lua` and configure them in `lspconfig.lua`.

## Formatters

Managed by conform.nvim. Install the tools on your system:

```sh
npm install -g prettier        # JS/TS/CSS/HTML/JSON/YAML/Markdown
pip install black              # Python
brew install stylua            # Lua
# google-java-format via Mason (:Mason)
```

Formatting is **not** run on save — trigger it manually with `<leader>fm`. This avoids conflicts with team pre-commit hooks.

## Key Mappings

`<leader>` is `Space`.

### Navigation
| Key | Action |
|-----|--------|
| `<leader>ff` | Find files |
| `<leader>fr` | Recent files |
| `<leader>fs` | Live grep |
| `<leader>fc` | Grep word under cursor |
| `<leader>ft` | Find TODOs |
| `<leader>e` | Toggle file explorer |

### Windows & Tabs
| Key | Action |
|-----|--------|
| `<leader>sv` | Split vertical |
| `<leader>sh` | Split horizontal |
| `<leader>se` | Equalize splits |
| `<leader>sx` | Close split |
| `<leader>to` | New tab |
| `<leader>tx` | Close tab |
| `<leader>tn` / `<leader>tp` | Next / previous tab |
| `<leader>tf` | Open buffer in new tab |

### LSP (active when a language server attaches)
| Key | Action |
|-----|--------|
| `gd` | Go to definition |
| `gD` | Go to declaration |
| `gR` | References |
| `gi` | Implementations |
| `gt` | Type definitions |
| `K` | Hover docs |
| `<leader>ca` | Code actions |
| `<leader>rn` | Rename symbol |
| `<leader>d` | Line diagnostics |
| `<leader>D` | Buffer diagnostics |
| `[d` / `]d` | Prev / next diagnostic |
| `<leader>rs` | Restart LSP |

### Editing
| Key | Action |
|-----|--------|
| `<leader>fm` | Format file or selection |
| `gcc` | Toggle line comment |
| `gc` (visual) | Toggle block comment |

### Database
| Key | Action |
|-----|--------|
| `<leader>db` | Toggle DB UI |
| `<leader>df` | Find DB buffer |

### AI
| Key | Action |
|-----|--------|
| `<leader>ac` | Toggle Claude Code panel |

## Colorscheme

Uses [Catppuccin](https://github.com/catppuccin/nvim) with automatic light/dark mode detection from macOS system preferences (Latte in light mode, Mocha in dark). Background is transparent to blend with your terminal theme.

To use a different flavor, edit `lua/jjohnson/plugins/colorscheme.lua`.
