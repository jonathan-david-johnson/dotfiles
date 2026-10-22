# Theme setup and troubleshooting

How colors reach pi in the `ghostty -> herdr -> pi` stack, and how to fix a theme that looks wrong. Read this when pi's colors are hard to read or differ from what you configured.

## How the stack works

Three layers set colors. Each one can override the one below it.

| Layer | What it controls | Where it is configured |
|---|---|---|
| Ghostty | The real background, foreground, and 16-color palette | `~/.config/ghostty/config` **and** `~/Library/Application Support/com.mitchellh.ghostty/config.ghostty` |
| Herdr | Its own UI, and the colors it reports to programs in its panes | `~/dotfiles/.config/herdr/config.toml` (`[theme]`) |
| pi | Text, headings, code, diffs | `theme` in `agent/settings.json`, with theme files in `agent/themes/` |

At startup, pi asks the terminal for its default foreground, background, and 16-color palette. It uses the background to decide light or dark, then picks a theme from the pair in `settings.json`.

Current setting: `"theme": "intellij-light/tokyo-night"`. Pi uses `intellij-light` on a light terminal and `tokyo-night` on a dark one.

## Known cause: Ghostty has two config files

Ghostty on macOS reads both files above. It loads `~/.config/ghostty/config` first, then `~/Library/Application Support/com.mitchellh.ghostty/config.ghostty`. The later file wins. A `theme` line in the second file silently overrides the first.

The second file is not in the dotfiles repo, so nothing tracks changes to it.

Incident, 2026-10-22: `config.ghostty` set `theme = light:TokyoNight Day`, which has a `#e1e2e7` gray background. That overrode `GitHub Light Default` (`#ffffff`) from `~/.config/ghostty/config`. Text meant for a white background was hard to read on the gray one.

Check the effective theme:

```sh
ghostty +show-config | rg "^(theme|background|foreground) "
```

Both files now set `GitHub Light Default` for light mode and `TokyoNight` for dark mode.

## Why pi colors can differ from the theme you chose

**Pi falls back to the dark theme.** Pi guesses dark until the terminal answers. It also uses dark if the terminal never answers and `COLORFGBG` is unset. The result is a light terminal showing `tokyo-night`: pale blue inline code, tan headings and pink errors. These pastel colors are nearly invisible on white.

**Pi does not switch live inside Herdr.** A pi session that is already running kept its old theme after the Ghostty or macOS appearance changed. Running pi directly in Ghostty does switch live. Herdr probably does not forward the appearance-change notification to programs in its panes. This is not confirmed. Restart pi after changing appearance.

**Pi's theme color is not the only color on screen.** Where pi sets no color, such as the prompt and the settings list, text uses the terminal's own foreground. Change that in Ghostty, not in a pi theme.

## Diagnose

### Probe what the terminal reports

`scripts/term-color-probe.py` sends the same color queries pi sends at startup and prints each reply. Run it in a real terminal pane. It cannot run inside pi, because pi's shell has no controlling terminal (`/dev/tty` fails with "Device not configured").

```sh
python3 ~/dotfiles/.pi/scripts/term-color-probe.py
```

Healthy output on a white light theme:

- `bg` is `rgb:ffff/ffff/ffff`.
- `mode` is `?997;2n`. `?997;1n` means dark and `?997;2n` means light.
- The startup burst returns `10`, `11`, palette `0` to `15`, then a device-attributes reply, in that order. Replies arrive within about a second.

If `bg` is empty, the terminal or Herdr is not answering color queries, and pi falls back to dark. If `bg` is not the color you expect, a Ghostty or Herdr theme is overriding yours. Run the probe in a plain Ghostty window, then inside Herdr, and compare.

### Identify which pi theme is active

Run `/theme` in pi. The row shows the setting (the pair), not the theme in use, so also look at the colors:

| Element | `intellij-light` | `tokyo-night` |
|---|---|---|
| Headings | orange `#cc7832` | tan `#e0af68` |
| Inline code | teal `#008787` | light blue `#7dcfff` |
| Warnings | olive `#8a6d00` | tan `#e0af68` |

You can also sample pixel colors from a screenshot. macOS color management shifts saturated colors slightly, so compare hues, not exact values.

### Check that a theme file loads

Theme loading failures fall back to pi's system theme silently. A custom theme loads if this prints `loaded` for it:

```sh
PI_CODING_AGENT_DIR=~/.pi/agent node -e "
import('$HOME/.cache/pi-mono-tool-groups/packages/coding-agent/dist/modes/interactive/theme/theme.js')
  .then(T => console.log(T.getThemeByName('intellij-light') ? 'loaded' : 'FAILED'))"
```

## Contrast on a white background

`intellij-light` was designed for white. Contrast ratios against `#ffffff` (WCAG asks for 4.5 or more for normal text):

| Ratio | Color | Used for |
|---|---|---|
| 2.50 | `dim` `#a0a4aa` | dim text, thinking "off" |
| 2.56 | `borderDark` `#9aa3ad` | code block and quote borders, rules |
| 3.33 | `orange` `#cc7832` | headings, keywords |
| 4.33 | `muted` `#737a84` | comments, link URLs |
| 4.36 | `teal` `#008787` | inline code |
| 4.9 to 5.7 | `yellow`, `blue`, `blue2`, `green`, `red` | warnings, links, strings, diffs, errors |

Against the gray `#e1e2e7` the same colors are worse: orange is 2.58 and teal is 3.37. Prefer a white terminal background over darkening the theme.

If the weak colors are still too faint on white, darken `dim`, `borderDark`, and `orange` in `agent/themes/intellij-light.json`. Suggested starting values: `#7d838c`, `#6f7882`, `#a65a14`.

## Herdr settings

Herdr's `[theme]` section has `auto_switch = true`, `light_name = "one-light"`, and `dark_name = "tokyo-night"`. In the probe, Herdr returned Ghostty's colors, so Herdr passes Ghostty's palette through to pi.

Choosing a theme through Herdr's Settings (`leader+s`) turns `auto_switch` off and pins that theme. If colors stop following Ghostty's light and dark mode, check for this.

Herdr also has `name = "terminal"`, which makes its own UI follow the Ghostty palette. It was not needed to fix this problem.
