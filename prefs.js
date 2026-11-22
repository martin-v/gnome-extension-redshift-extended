import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function formatTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export default class RedshiftExtendedPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Evening dimming',
            description: 'The target time must be between the start and end times, including across midnight.',
        });
        page.add(group);
        window.add(page);

        for (const [key, title] of [
            ['start-time', 'Start time'],
            ['target-time', 'Target time'],
            ['end-time', 'End time (restore original values)'],
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
            ['target-temperature', 'Night Light target temperature (K)', 1000, 6500, 100, true],
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
