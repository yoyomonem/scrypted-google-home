import { ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import { addSupportedType, queryResponse, syncResponse } from '../common';

addSupportedType({
    type: ScryptedDeviceType.Camera,
    probe: async (device) => {
        if (!device.interfaces.includes(ScryptedInterface.VideoCamera))
            return;

        const ret = syncResponse(device, 'action.devices.types.CAMERA');
        ret.traits.push('action.devices.traits.CameraStream');
        ret.attributes = {
            cameraStreamSupportedProtocols: [
                "progressive_mp4", "hls", "dash", "smooth_stream"
            ],
            cameraStreamNeedAuthToken: true,
            cameraStreamNeedDrmEncryption: false
        }
        return ret;
    },
    query: async (device: ScryptedDevice) => {
        const ret = queryResponse(device);
        return ret;
    },
})
