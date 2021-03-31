import { BinarySensor, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import { addSupportedType, syncResponse } from '../common';

addSupportedType({
    type: ScryptedDeviceType.Sensor,
    probe: async (device) => {
        if (!device.interfaces.includes(ScryptedInterface.BinarySensor))
            return;
    
        const ret = syncResponse(device, 'action.devices.types.DOOR');
        ret.traits.push('action.devices.traits.OpenClose');
        ret.attributes.queryOnlyOpenClose = true;
        return ret;
    },
    query: async (device: ScryptedDevice & BinarySensor) => {
        const ret: any= {};
        ret.openPercent = device.binaryState ? 100 : 0;
        return ret;
    },
})
