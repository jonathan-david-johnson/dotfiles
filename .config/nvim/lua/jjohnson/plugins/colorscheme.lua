return {
  "projekt0n/github-nvim-theme",
  name = "github-theme",
  priority = 1000,
  config = function()
    require("github-theme").setup({
      options = {
        dim_inactive = false,
        transparent = false,
        terminal_colors = false,
        styles = {
          comments = "italic",
          keywords = "italic",
        },
      },
      integrations = {
        cmp = true,
        gitsigns = true,
        nvimtree = true,
        treesitter = true,
        telescope = { enabled = true },
        mason = true,
        which_key = true,
        indent_blankline = { enabled = true },
        native_lsp = {
          enabled = true,
          underlines = { errors = { "undercurl" }, hints = { "undercurl" }, warnings = { "undercurl" }, information = { "undercurl" } },
        },
      },
    })

    -- Apply the right variant based on background setting
    local function apply_bg_colorscheme()
      if vim.o.background == "light" then
        vim.cmd.colorscheme("github_light")
      else
        vim.cmd.colorscheme("github_dark")
      end
    end

    apply_bg_colorscheme()

    vim.api.nvim_create_autocmd("OptionSet", {
      pattern = "background",
      callback = apply_bg_colorscheme,
    })
  end,
}
