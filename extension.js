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

function hourToMinutes(hour) {
    return Math.round(((hour % 24) + 24) % 24 * 60);
}

export default class RedshiftExtended extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._color = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.color'});
        this._enabled = true;
        this._busy = false;
        this._schedule = null;
        this._scheduleReadAt = 0;
        this._scheduleChangedId = this._color.connect('changed', (_, key) => {
            if (['night-light-schedule-automatic', 'night-light-schedule-from',
                'night-light-schedule-to'].includes(key))
                this._schedule = null;
        });
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
        this._color.disconnect(this._scheduleChangedId);
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
        const schedule = await this._getSchedule();
        const start = hourToMinutes(schedule.from);
        const end = hourToMinutes(schedule.to);
        const duration = (end - start + 1440) % 1440 || 1440;
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const elapsed = (currentTime - start + 1440) % 1440;
        if (elapsed >= duration) {
            await this._restore();
            return;
        }

        const progress = elapsed / duration;
        let original = this._settings.get_uint('original-temperature');
        if (original === 0) {
            original = await getProperty(COLOR, 'Temperature');
            this._settings.set_uint('original-temperature', original);
        }
        const temperature = Math.round(original +
            (Math.min(original, this._settings.get_uint('target-temperature')) - original) * progress);
        await setProperty(COLOR, 'Temperature', 'u', temperature);
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

    async _getSchedule() {
        const now = GLib.get_monotonic_time();
        if (this._schedule && now - this._scheduleReadAt < 300000000)
            return this._schedule;

        const automatic = this._color.get_boolean('night-light-schedule-automatic');
        let from = this._color.get_double('night-light-schedule-from');
        let to = this._color.get_double('night-light-schedule-to');
        if (automatic) {
            try {
                from = await getProperty(COLOR, 'Sunset');
                to = await getProperty(COLOR, 'Sunrise');
                if (!(from > 0 && to > 0)) {
                    from = this._color.get_double('night-light-schedule-from');
                    to = this._color.get_double('night-light-schedule-to');
                }
            } catch (error) {
                console.warn(`Redshift Extended: could not read GNOME's sunrise and sunset: ${error.message}`);
            }
        }

        this._schedule = {from, to};
        this._scheduleReadAt = now;
        return this._schedule;
    }

    async _restore() {
        const original = this._settings.get_uint('original-temperature');
        const applied = this._settings.get_uint('applied-temperature');
        if (original !== 0) {
            try {
                if (await getProperty(COLOR, 'Temperature') === applied)
                    await setProperty(COLOR, 'Temperature', 'u', original);
                this._settings.set_uint('original-temperature', 0);
                this._settings.set_uint('applied-temperature', 0);
            } catch (error) {
                console.error(`Redshift Extended: could not restore GNOME color temperature: ${error.message}`);
            }
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
