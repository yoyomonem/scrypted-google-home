import { Battery, Dock, Pause, ScryptedDevice, ScryptedDeviceType, ScryptedInterface, StartStop } from '@scrypted/sdk';
import { addSupportedType, queryResponse, syncResponse } from '../common';


addSupportedType({
    type: ScryptedDeviceType.Vacuum,
    probe: async (device: ScryptedDevice) => {
        if (!device.interfaces.includes(ScryptedInterface.StartStop))
            return;

        const ret = syncResponse(device, 'action.devices.types.VACUUM');
        ret.traits.push('action.devices.traits.StartStop');
        if (device.interfaces.includes(ScryptedInterface.Dock)) {
            ret.attributes.pausable = true;
            ret.traits.push('action.devices.traits.Dock');
        }
        else {
            ret.attributes.pausable = true;
        }
        return ret;
    },
    query: async (device: ScryptedDevice & StartStop & Dock & Battery & Pause) => {
        const ret = queryResponse(device);
        ret.isRunning = device.running;
        ret.isPaused = device.interfaces.includes(ScryptedInterface.Pause) && device.paused;
        if (device.interfaces.includes(ScryptedInterface.Dock))
            ret.isDocked = device.docked;
        return ret;
    },
})
