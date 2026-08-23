return {
  'MeanderingProgrammer/render-markdown.nvim',
  dependencies = { 'nvim-treesitter/nvim-treesitter', 'echasnovski/mini.nvim' },
  opts = {
    -- Only render in normal/command/terminal mode, show raw source in insert
    -- Like IntelliJ: edit raw, view rendered with a single toggle
    render_modes = { 'n', 'c', 't' },
    heading = {
      -- No sign column icons — keeps it clean
      sign = false,
      -- Different icons per heading level create a size hierarchy
      icons = { ' ', ' ', ' ', ' ', ' ', ' ' },
      -- Full-width heading backgrounds look more like a rendered doc
      width = 'full',
    },
    code = {
      sign = false,
      -- Show language name above code blocks (like a rendered page would)
      style = 'language',
      left_pad = 1,
      right_pad = 1,
    },
    checkbox = {
      enabled = true,
      position = 'inline',
    },
    quote = {
      repeat_linebreak = false,
    },
    dash = {
      width = 1,
    },
  },
}
