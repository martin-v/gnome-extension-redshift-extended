import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function formatTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function formatHour(hour) {
    const minutes = Math.round(((hour % 24) + 24) % 24 * 60);
    return formatTime(minutes);
}

function getColorProperty(property) {
    return new Promise((resolve, reject) => {
        Gio.DBus.session.call('org.gnome.SettingsDaemon.Color', '/org/gnome/SettingsDaemon/Color',
            'org.freedesktop.DBus.Properties', 'Get',
            new GLib.Variant('(ss)', ['org.gnome.SettingsDaemon.Color', property]),
            new GLib.VariantType('(v)'), Gio.DBusCallFlags.NONE, 3000, null,
            (connection, result) => {
                try {
                    resolve(connection.call_finish(result).get_child_value(0)
                        .get_variant().deep_unpack());
                } catch (error) {
                    reject(error);
                }
            });
    });
}

export default class RedshiftExtendedPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const color = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.color'});
        const page = new Adw.PreferencesPage();
        const gnomeGroup = new Adw.PreferencesGroup({
            title: 'GNOME Night Light',
            description: 'The extension follows GNOME Night Light scheduling and intensifies its color temperature adjustment.',
        });
        const enabledRow = new Adw.ActionRow({title: 'Night Light'});
        const enabledValue = new Gtk.Label({valign: Gtk.Align.CENTER});
        enabledRow.add_suffix(enabledValue);
        gnomeGroup.add(enabledRow);

        const scheduleRow = new Adw.ActionRow({title: 'GNOME schedule'});
        gnomeGroup.add(scheduleRow);
        const temperatureRow = new Adw.ActionRow({title: 'GNOME target temperature'});
        const temperatureValue = new Gtk.Label({valign: Gtk.Align.CENTER});
        temperatureRow.add_suffix(temperatureValue);
        gnomeGroup.add(temperatureRow);
        page.add(gnomeGroup);

        let updateId = 0;
        const updateGnomeValues = async () => {
            const id = ++updateId;
            enabledValue.label = color.get_boolean('night-light-enabled') ? 'Enabled' : 'Disabled';
            temperatureValue.label = `${color.get_uint('night-light-temperature')} K`;
            const automatic = color.get_boolean('night-light-schedule-automatic');
            if (!automatic) {
                scheduleRow.subtitle = `Manual: ${formatHour(color.get_double('night-light-schedule-from'))} – ${formatHour(color.get_double('night-light-schedule-to'))}`;
                return;
            }
            try {
                const [sunset, sunrise] = await Promise.all([
                    getColorProperty('Sunset'),
                    getColorProperty('Sunrise'),
                ]);
                if (id === updateId && Number.isFinite(sunset) && Number.isFinite(sunrise) &&
                    sunset > 0 && sunrise > 0) {
                    scheduleRow.subtitle = `Automatic: sunset ${formatHour(sunset)} – sunrise ${formatHour(sunrise)}`;
                } else if (id === updateId) {
                    scheduleRow.subtitle = `Automatic unavailable; GNOME fallback: ${formatHour(color.get_double('night-light-schedule-from'))} – ${formatHour(color.get_double('night-light-schedule-to'))}`;
                }
            } catch (error) {
                if (id === updateId)
                    scheduleRow.subtitle = `Automatic unavailable; GNOME fallback: ${formatHour(color.get_double('night-light-schedule-from'))} – ${formatHour(color.get_double('night-light-schedule-to'))}`;
            }
        };
        updateGnomeValues();
        const changedId = color.connect('changed', updateGnomeValues);
        const refreshTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 300, () => {
            updateGnomeValues();
            return GLib.SOURCE_CONTINUE;
        });
        window.connect('close-request', () => {
            GLib.source_remove(refreshTimer);
            color.disconnect(changedId);
            return false;
        });

        const group = new Adw.PreferencesGroup({
            title: 'Additional evening dimming',
            description: 'The fade and target times must both fall within GNOME Night Light hours.',
        });
        page.add(group);
        window.add(page);

        for (const [key, title] of [
            ['fade-start-time', 'Start fading at'],
            ['target-time', 'Reach target values at'],
        ]) {
            const row = new Adw.ActionRow({title, subtitle: '24-hour format: HH:MM'});
            const entry = new Gtk.Entry({
                text: formatTime(settings.get_int(key)),
                width_chars: 5,
                max_length: 5,
                valign: Gtk.Align.CENTER,
            });
            entry.connect('changed', () => {
                const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(entry.text);
                if (match) {
                    settings.set_int(key, Number(match[1]) * 60 + Number(match[2]));
                    entry.remove_css_class('error');
                } else {
                    entry.add_css_class('error');
                }
            });
            row.add_suffix(entry);
            group.add(row);
        }

        for (const [key, title, min, max, step, unsigned] of [
            ['target-temperature', 'Additional color temperature target (K)', 1000, 6500, 100, true],
            ['target-brightness', 'Target brightness (%)', 1, 100, 1, false],
        ]) {
            const row = new Adw.ActionRow({title});
            const spin = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: min, upper: max, step_increment: step, page_increment: step * 10,
                    value: unsigned ? settings.get_uint(key) : settings.get_int(key),
                }),
                valign: Gtk.Align.CENTER,
                numeric: true,
            });
            spin.connect('value-changed', () => {
                if (unsigned)
                    settings.set_uint(key, spin.get_value_as_int());
                else
                    settings.set_int(key, spin.get_value_as_int());
            });
            row.add_suffix(spin);
            group.add(row);
        }
    }
}
