-- ============================================================
-- Theme Lab — rapid-fire light theme tester
-- Press <leader>uC to cycle forward, <leader>uP to go back
-- Nothing persists; restart = back to your normal Catppuccin
-- ============================================================

local light_themes = {
  {
    name = "Catppuccin Latte",
    colorscheme = "catppuccin-latte",
    setup = function()
      require("catppuccin").setup({ flavour = "latte", transparent_background = false })
    end,
  },
  {
    name = "Rose Pine Dawn",
    colorscheme = "rose-pine-dawn",
    setup = function()
      require("rose-pine").setup({ variant = "dawn", disable_background = true })
    end,
  },
  {
    name = "Kanagawa Lotus",
    colorscheme = "kanagawa-lotus",
    setup = function()
      require("kanagawa").setup({ theme = "lotus" })
    end,
  },
  {
    name = "Tokyo Night Day",
    colorscheme = "tokyonight-day",
    setup = function()
      require("tokyonight").setup({ style = "day" })
    end,
  },
  {
    name = "Dayfox",
    colorscheme = "dayfox",
  },
  {
    name = "Dawnfox",
    colorscheme = "dawnfox",
  },
  {
    name = "One Light",
    colorscheme = "onelight",
    setup = function()
      require("onedark").setup({ style = "light" })
    end,
  },
  {
    name = "Gruvbox Light",
    colorscheme = "gruvbox",
    setup = function()
      require("gruvbox").setup({ contrast = "soft" })
    end,
  },

}

local idx = 0

local function apply_theme(t)
  local ok, err = pcall(function()
    if t.setup then
      t.setup()
    end
    vim.cmd.colorscheme(t.colorscheme)
  end)
  if ok then
    vim.notify("☀️  " .. t.name .. "  [" .. idx .. "/" .. #light_themes .. "]", vim.log.levels.INFO)
  else
    vim.notify("❌ Failed: " .. t.name .. " — " .. tostring(err), vim.log.levels.ERROR)
  end
end

local function cycle()
  idx = (idx % #light_themes) + 1
  apply_theme(light_themes[idx])
end

local function prev()
  idx = idx - 1
  if idx < 1 then
    idx = #light_themes
  end
  apply_theme(light_themes[idx])
end

-- Register keymaps immediately (this file runs during lazy's import phase)
vim.keymap.set("n", "<leader>uC", cycle, { desc = "Next light theme" })
vim.keymap.set("n", "<leader>uP", prev, { desc = "Prev light theme" })
vim.api.nvim_create_user_command("ThemeLabNext", cycle, {})
vim.api.nvim_create_user_command("ThemeLabPrev", prev, {})

-- Return the actual theme plugins as lazy specs so they get installed
return {
  { "rose-pine/neovim", name = "rose-pine", lazy = true },
  { "rebelot/kanagawa.nvim", name = "kanagawa", lazy = true },
  { "folke/tokyonight.nvim", name = "tokyonight", lazy = true },
  { "EdenEast/nightfox.nvim", name = "nightfox", lazy = true },
  { "navarasu/onedark.nvim", name = "onedark", lazy = true },
  { "ellisonleao/gruvbox.nvim", name = "gruvbox", lazy = true },
}
