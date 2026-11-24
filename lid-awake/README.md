# lid-awake

Keeps the Mac awake with the lid closed only while on AC power.

`sudo pmset -c disablesleep 1` was tried and had no effect: `disablesleep` is a
single system-wide flag (`pmset -g | rg SleepDisabled`), not a per-power-source
setting. So a small root daemon polls the power source and toggles it.

## Install

```
sudo install -m 755 ~/dotfiles/lid-awake/lid-awake /usr/local/bin/lid-awake
sudo install -m 644 -o root -g wheel ~/dotfiles/lid-awake/local.lid-awake.plist /Library/LaunchDaemons/local.lid-awake.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/local.lid-awake.plist
```

## Verify

```
pmset -g | rg SleepDisabled      # 1 on AC, 0 on battery (within ~5 s)
```

## Uninstall

```
sudo launchctl bootout system /Library/LaunchDaemons/local.lid-awake.plist
sudo rm /Library/LaunchDaemons/local.lid-awake.plist /usr/local/bin/lid-awake
sudo pmset disablesleep 0
```

## Caution

A closed lid traps heat. Do not put the Mac in a bag while it is plugged in and
awake.
