-- Dvorak fix: Rex's default pane/tab bindings on the bracket keys use physical key
-- positions ([BracketRight], [BracketLeft]). On Dvorak those positions are the "=" and "/"
-- keys, so they shadow cmd+= / cmd+shift+= (font increase) and cmd+/ (toggle sidebar).
-- Unbind the physical versions and bind the characters printed on the keys instead.

rex.unbind("cmd+[BracketRight]")
rex.unbind("cmd+[BracketLeft]")
rex.unbind("cmd+shift+[BracketRight]")
rex.unbind("cmd+shift+[BracketLeft]")

rex.bind("cmd+]", "pane.focus_next")
rex.bind("cmd+[", "pane.focus_previous")
rex.bind("cmd+shift+]", "client.tab.next")
rex.bind("cmd+shift+[", "client.tab.previous")

-- rexurrect: restore the latest saved layout when the server starts
do local r = rex.exec({ [[/Users/jdj/.cargo/bin/rexurrect]], "auto-restore" }, { env = { REXURRECT_STATE_DIR = [[/Users/jdj/.local/state/rexurrect]], REXURRECT_CONFIG = [[/Users/jdj/.config/rexurrect/config.toml]] } }) if r then io.stderr:write(r.stderr) end end
