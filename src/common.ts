
import { ScryptedDevice, ScryptedDeviceType } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
import { SmartHomeV1ExecuteResponseCommands, SmartHomeV1SyncDevices } from 'actions-on-google/dist/service/smarthome/api/v1';

const { systemManager } = sdk;

interface SupportedType {
    type: ScryptedDeviceType;
    probe: (device: ScryptedDevice & any) => Promise<SmartHomeV1SyncDevices | undefined>;
    query: (device: ScryptedDevice & any) => Promise<any>;
}

export const supportedTypes: { [type: string]: SupportedType } = {};

export function addSupportedType(type: SupportedType) {
    supportedTypes[type.type] = type;
}

export function syncResponse(device: ScryptedDevice, type: string): SmartHomeV1SyncDevices {
    return {
        id: device.id,
        name: {
            name: device.name,
            defaultNames: [],
            nicknames: [],
        },
        attributes: {},
        traits: [],
        type,
        willReportState: true,
    }
}

export function executeResponse(device: ScryptedDevice): SmartHomeV1ExecuteResponseCommands {
    return {
        ids: [device.id],
        status: 'SUCCESS',
    }
}