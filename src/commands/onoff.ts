import { OnOff, ScryptedDevice } from "@scrypted/sdk";
import { executeResponse } from "../common";
import { commandHandlers } from "../handlers";

commandHandlers['action.devices.commands.OnOff'] = async (device: ScryptedDevice & OnOff, execution) => {
    const ret = executeResponse(device);
    if (execution.params.on === false)
        (device as OnOff).turnOff();
    else
        (device as OnOff).turnOn();
    return ret;
}
