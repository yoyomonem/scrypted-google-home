import { Brightness, ColorSettingHsv, ColorSettingRgb, ColorSettingTemperature, OnOff, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import { addSupportedType, queryResponse, syncResponse } from '../common';

addSupportedType({
    type: ScryptedDeviceType.Light,
    probe: async (device) => {
        if (!device.interfaces.includes(ScryptedInterface.OnOff))
            return;
    
        const ret = syncResponse(device, 'action.devices.types.LIGHT');
        ret.traits.push('action.devices.traits.OnOff');
        
        if (device.interfaces.includes(ScryptedInterface.Brightness))
            ret.traits.push('action.devices.traits.Brightness');

        if (device.interfaces.includes(ScryptedInterface.ColorSettingHsv) ||
            device.interfaces.includes(ScryptedInterface.ColorSettingRgb) ||
            device.interfaces.includes(ScryptedInterface.ColorSettingTemperature)) {
            ret.traits.push('action.devices.traits.ColorSetting');

            if (device.interfaces.includes(ScryptedInterface.ColorSettingHsv))
                ret.attributes['colorModel'] = 'hsv';
            else
                ret.attributes['colorModel'] = 'rgb';

            if (device.interfaces.includes(ScryptedInterface.ColorSettingTemperature)) {
                ret.attributes.colorTemperatureRange = {
                    temperatureMinK: await (device as ColorSettingTemperature).getTemperatureMinK(),
                    temperatureMaxK: await (device as ColorSettingTemperature).getTemperatureMaxK(),
                };
            }
        }
        return ret;
    },
    query: async (device: ScryptedDevice & OnOff & Brightness & ColorSettingHsv & ColorSettingRgb & ColorSettingTemperature) => {
        const ret = queryResponse(device);
        ret.on = device.on;
        if (device.interfaces.includes(ScryptedInterface.Brightness))
            ret.brightness = device.brightness;
        if (device.interfaces.includes(ScryptedInterface.ColorSettingHsv)) {
            const {hsv} = device;
            ret.spectrumHsv = {
                hue: hsv.h,
                saturation: hsv.s,
                value: hsv.v,
            }
        }
        else if (device.interfaces.includes(ScryptedInterface.ColorSettingRgb)) {
            const {rgb} = device;
            ret.spectrumRgb = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
        }

        if (device.interfaces.includes(ScryptedInterface.ColorSettingTemperature))
            ret.temperatureK = device.colorTemperature;

        return ret;
    },
})
