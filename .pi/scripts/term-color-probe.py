#!/usr/bin/env python3
"""Probe what the terminal reports for background/foreground color and
light/dark mode. Run it in a real terminal pane (needs /dev/tty).

If `bg` comes back empty, the terminal (or a multiplexer such as herdr)
isn't answering color queries, so pi falls back to its dark theme.
"""
import os, select, termios, tty

fd = os.open('/dev/tty', os.O_RDWR)
old = termios.tcgetattr(fd)

def query(seq):
    tty.setraw(fd)
    os.write(fd, seq.encode())
    out = b''
    while select.select([fd], [], [], 0.5)[0]:
        out += os.read(fd, 256)
    termios.tcsetattr(fd, termios.TCSADRAIN, old)
    return out

try:
    for name, seq in [('bg', '\x1b]11;?\x1b\\'),
                      ('fg', '\x1b]10;?\x1b\\'),
                      ('mode', '\x1b[?996n')]:
        print(name, query(seq))
finally:
    termios.tcsetattr(fd, termios.TCSADRAIN, old)

# Second probe: send the exact burst pi sends at startup (OSC 10, OSC 11,
# OSC 4 for palette 0-15, then DA1) and show every reply in order.
import re
burst = '\x1b]10;?\x07\x1b]11;?\x07' + ''.join(
    f'\x1b]4;{i};?\x07' for i in range(16)) + '\x1b[c'
fd = os.open('/dev/tty', os.O_RDWR)
old = termios.tcgetattr(fd)
try:
    tty.setraw(fd)
    os.write(fd, burst.encode())
    buf = b''
    import time
    t0 = time.monotonic()
    first = last = None
    while select.select([fd], [], [], 1.0)[0]:
        buf += os.read(fd, 1024)
        last = time.monotonic() - t0
        if first is None:
            first = last
finally:
    termios.tcsetattr(fd, termios.TCSADRAIN, old)
print('\npi startup burst: %d bytes, first reply %s, last reply %s' % (len(buf), first and '%.0f ms' % (first*1000), last and '%.0f ms' % (last*1000)))
for m in re.findall(rb'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[?\d;]*[a-zA-Z]', buf):
    print('  ', m)
