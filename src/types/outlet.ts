import { OnOff, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import { addSupportedType, queryResponse, syncResponse } from '../common';

addSupportedType({
    type: ScryptedDeviceType.Outlet,
    probe: async (device) => {
        if (!device.interfaces.includes(ScryptedInterface.OnOff))
            return;
    
        const ret = syncResponse(device, 'action.devices.types.OUTLET');
        ret.traits.push('action.devices.traits.OnOff');
        return ret;
    },
    query: async (device: ScryptedDevice & OnOff) => {
        const ret = queryResponse(device);
        ret.on = device.on;
        return ret;
    },
})
