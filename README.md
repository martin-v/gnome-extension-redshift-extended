# Redshift Extended

A GNOME Shell extension for the built-in Night Light:

- At 12:00, Night Light is re-enabled and “Disable Until Tomorrow” is cleared.
  GNOME's normal Night Light schedule remains unchanged.
- The extension reads GNOME's Night Light schedule and acts only within that
  time window. By default, fading starts at 23:00 and the configured target
  color temperature and brightness are reached at 01:00. Original values are
  restored outside GNOME's scheduled period. The fade start and target times
  are configurable and this also works across midnight.

The extension preferences show GNOME's Night Light enabled state, schedule, and
configured target temperature; the extension does not change GNOME's saved
temperature setting. The extension's target temperature defaults to 1800 K and
its target brightness to 20%. Values that are already lower are not increased.
The fade starts at 23:00 by default and reaches the target values at 01:00.
Both times must fall within GNOME's Night Light schedule. The schedule and GNOME
target temperature can be changed in GNOME Settings.

GNOME Night Light must be enabled for its color temperature adjustment to be
visible. Manually disabling Night Light remains in effect until it is
re-enabled at 12:00. The extension must be running at that time; if the system
is suspended through noon, Night Light is re-enabled when the system wakes.
While dimming is active, the extension overrides manual changes. Outside the
scheduled period or when the extension is disabled, it restores only values
that it last set itself.

GNOME Settings Daemon defaults are Night Light disabled, automatic sunset to
sunrise scheduling enabled, manual schedule fallback from 20:00 to 06:00, and
a target color temperature of 2700 K. Automatic times depend on the detected
location; the manual times are used when automatic scheduling is turned off or
sunrise/sunset cannot be determined.

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
