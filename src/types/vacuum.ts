import { Battery, Dock, Pause, ScryptedDevice, ScryptedDeviceType, ScryptedInterface, StartStop } from '@scrypted/sdk';
import { addSupportedType, syncResponse } from '../common';

function capacityToDescription(device: Battery): string {
    if (device.batteryLevel > 98)
        return 'FULL';
    if (device.batteryLevel > 80)
        return 'HIGH';
    if (device.batteryLevel > 40)
        return 'MEDIUM';
    if (device.batteryLevel > 20)
        return 'LOW';
    return 'CRITICALLY_LOW';
}

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
        if (device.interfaces.includes(ScryptedInterface.Battery)) {
            ret.traits.push('action.devices.traits.EnergyStorage');
            ret.attributes.queryOnlyEnergyStorage = true;
        }
        return ret;
    },
    query: async (device: ScryptedDevice & StartStop & Dock & Battery & Pause) => {
        const ret: any = {};
        ret.isRunning = device.running;
        ret.isPaused = device.interfaces.includes(ScryptedInterface.Pause) && device.paused;
        if (device.interfaces.includes(ScryptedInterface.Dock))
            ret.isDocked = device.docked;
        if (device.interfaces.includes(ScryptedInterface.Battery)) {
            ret.descriptiveCapacityRemaining = capacityToDescription(device);
            ret.capacityRemaining = [
                {
                    unit: 'PERCENTAGE',
                    rawValue: device.batteryLevel,
                }
            ]
        }
        return ret;
    },
})
