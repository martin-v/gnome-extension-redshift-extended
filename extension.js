import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const COLOR = ['org.gnome.SettingsDaemon.Color', '/org/gnome/SettingsDaemon/Color',
    'org.gnome.SettingsDaemon.Color'];
const SCREEN = ['org.gnome.SettingsDaemon.Power', '/org/gnome/SettingsDaemon/Power',
    'org.gnome.SettingsDaemon.Power.Screen'];

function dbusCall(service, method, parameters, replyType) {
    return new Promise((resolve, reject) => {
        Gio.DBus.session.call(service[0], service[1], 'org.freedesktop.DBus.Properties',
            method, parameters, replyType, Gio.DBusCallFlags.NONE, 3000, null,
            (connection, result) => {
                try {
                    resolve(connection.call_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
    });
}

async function getProperty(service, property) {
    const result = await dbusCall(service, 'Get',
        new GLib.Variant('(ss)', [service[2], property]), new GLib.VariantType('(v)'));
    return result.get_child_value(0).get_variant().deep_unpack();
}

async function setProperty(service, property, type, value) {
    await dbusCall(service, 'Set',
        new GLib.Variant('(ssv)', [service[2], property, new GLib.Variant(type, value)]),
        null);
}

function dateKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export default class RedshiftExtended extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._color = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.color'});
        this._enabled = true;
        this._busy = false;
        this._lastCheck = new Date();
        this._tick();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        this._enabled = false;
        GLib.source_remove(this._timer);
        if (!this._busy)
            this._restore().catch(error => console.error(`Redshift Extended: ${error.message}`));
    }

    async _tick() {
        if (this._busy)
            return;
        this._busy = true;
        try {
            const now = new Date();
            await this._resetAtNoon(now);
            if (this._enabled)
                await this._update(now);
        } catch (error) {
            console.error(`Redshift Extended: ${error.message}`);
        } finally {
            this._busy = false;
            if (!this._enabled)
                await this._restore().catch(error => console.error(`Redshift Extended: ${error.message}`));
        }
    }

    async _resetAtNoon(now) {
        let noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
        if (now < noon)
            noon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
        const inNoonMinute = now.getHours() === 12 && now.getMinutes() === 0;
        const crossedNoon = this._lastCheck < noon && now >= noon;
        if ((inNoonMinute || crossedNoon) &&
            this._settings.get_string('last-noon-reset') !== dateKey(noon)) {
            this._color.set_boolean('night-light-enabled', true);
            await setProperty(COLOR, 'DisabledUntilTomorrow', 'b', false);
            this._settings.set_string('last-noon-reset', dateKey(noon));
        }
        this._lastCheck = now;
    }

    async _update(now) {
        const start = this._settings.get_int('start-time');
        const target = (this._settings.get_int('target-time') - start + 1440) % 1440;
        const end = (this._settings.get_int('end-time') - start + 1440) % 1440;
        const elapsed = (now.getHours() * 60 + now.getMinutes() - start + 1440) % 1440;
        if (target === 0 || end === 0 || target >= end || elapsed >= end) {
            await this._restore();
            return;
        }

        const progress = Math.min(elapsed / target, 1);
        let original = this._settings.get_uint('original-temperature');
        if (original === 0) {
            original = this._color.get_uint('night-light-temperature');
            this._settings.set_uint('original-temperature', original);
        }
        const temperature = Math.round(original +
            (Math.min(original, this._settings.get_uint('target-temperature')) - original) * progress);
        this._color.set_uint('night-light-temperature', temperature);
        this._settings.set_uint('applied-temperature', temperature);

        try {
            const current = await getProperty(SCREEN, 'Brightness');
            if (!this._enabled || current < 0 || current > 100)
                return;
            let brightness = this._settings.get_int('original-brightness');
            if (brightness < 0) {
                brightness = current;
                this._settings.set_int('original-brightness', brightness);
            }
            const value = Math.round(brightness +
                (Math.min(brightness, this._settings.get_int('target-brightness')) - brightness) * progress);
            if (value !== current)
                await setProperty(SCREEN, 'Brightness', 'i', value);
            this._settings.set_int('applied-brightness', value);
        } catch (error) {
            if (!this._brightnessUnavailable)
                console.warn(`Redshift Extended: screen brightness unavailable: ${error.message}`);
            this._brightnessUnavailable = true;
        }
    }

    async _restore() {
        const original = this._settings.get_uint('original-temperature');
        const applied = this._settings.get_uint('applied-temperature');
        if (original !== 0) {
            if (this._color.get_uint('night-light-temperature') === applied)
                this._color.set_uint('night-light-temperature', original);
            this._settings.set_uint('original-temperature', 0);
            this._settings.set_uint('applied-temperature', 0);
        }

        const brightness = this._settings.get_int('original-brightness');
        const last = this._settings.get_int('applied-brightness');
        if (brightness >= 0) {
            try {
                const current = await getProperty(SCREEN, 'Brightness');
                if (current === last && current !== brightness)
                    await setProperty(SCREEN, 'Brightness', 'i', brightness);
                this._settings.set_int('original-brightness', -1);
                this._settings.set_int('applied-brightness', -1);
            } catch (error) {
                if (!this._brightnessUnavailable)
                    console.warn(`Redshift Extended: screen brightness unavailable: ${error.message}`);
                this._brightnessUnavailable = true;
            }
        }
    }
}
