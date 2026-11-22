# Redshift Extended

A GNOME Shell extension for the built-in Night Light:

- At 12:00, Night Light is re-enabled and “Disable Until Tomorrow” is cleared.
  GNOME's normal Night Light schedule remains unchanged.
- Starting at a configurable time, Night Light color temperature and screen
  brightness are gradually reduced until they reach their target values. They
  remain at those values until the configured end time, when the original
  values are restored. This also works across midnight.

By default, dimming starts at 21:00 and reaches 1800 K and 20% brightness at
23:00; the original values are restored at 07:00. Values that are already lower
are not increased. The times, target temperature, and brightness can be changed
in the extension preferences. The target time must be after the start time and
before the end time; dimming is suspended if the times are not in this order.

GNOME's Night Light schedule must have Night Light enabled during the desired
period for the color temperature adjustment to be visible. Manually disabling
Night Light remains in effect until it is re-enabled at 12:00. The extension
must be running at that time; if the system is suspended through noon, Night
Light is re-enabled when the system wakes. While dimming is active, the
extension overrides manual changes. At the end time or when the extension is
disabled, it restores only values that it last set itself.

## Installation

Requires GNOME Shell 45–48 and GNOME Settings Daemon. Brightness control works
only on displays supported by GNOME, typically built-in laptop displays; Night
Light works independently of display brightness support.

Copy this repository to
`~/.local/share/gnome-shell/extensions/redshift-extended@martin-v/`, then run
the following commands from that directory:

```sh
glib-compile-schemas schemas
gnome-extensions enable redshift-extended@martin-v
gnome-extensions prefs redshift-extended@martin-v
```

If necessary, log out and back in after copying the extension so GNOME
recognizes it. When the extension is disabled, it restores the saved color
temperature and brightness unless they have since been changed elsewhere.
