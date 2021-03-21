import { ColorSettingTemperature, HttpRequest, HttpRequestHandler, HttpResponse, ScryptedDevice, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
import { SmartHomeV1DisconnectRequest, SmartHomeV1DisconnectResponse, SmartHomeV1ExecuteRequest, SmartHomeV1ExecuteResponse, SmartHomeV1ExecuteResponseCommands, SmartHomeV1QueryRequest, SmartHomeV1QueryResponse, SmartHomeV1ReportStateRequest, SmartHomeV1SyncDevices, SmartHomeV1SyncRequest, SmartHomeV1SyncResponse } from 'actions-on-google/dist/service/smarthome/api/v1';
import { smarthome } from 'actions-on-google/dist/service/smarthome';
import { Headers } from 'actions-on-google/dist/framework';
import { supportedTypes } from './common';
import axios from 'axios';
import throttle from 'lodash/throttle';

import './types';
import './commands';

import { commandHandlers } from './handlers';

const { systemManager } = sdk;

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function parseJwt(jwt: string) {
    try {
        return JSON.parse(jwt);
    }
    catch (e) {
    }
}

function isSyncable(device: ScryptedDevice): boolean {
    if (device.metadata?.['syncWithIntegrations'] === false)
        return false;
    if (device.metadata?.['syncWithGoogleHome'] === false)
        return false;
    return true;
}

class GoogleHome extends ScryptedDeviceBase implements HttpRequestHandler {
    linkTracker = localStorage.getItem('linkTracker');
    agentUserId = localStorage.getItem('agentUserId');
    app = smarthome({
        jwt: parseJwt(localStorage.getItem('jwt')),
    });
    reportQueue = new Set<string>();
    reportStateThrottled = throttle(() => this.reportState(), 2000);

    constructor() {
        super();

        if (!this.linkTracker) {
            this.linkTracker = Math.random().toString();
            localStorage.setItem('linkTracker', this.linkTracker);
        }

        if (!this.agentUserId) {
            this.agentUserId = uuidv4();
            localStorage.setItem('agentUserId', this.agentUserId);
        }

        this.app.onSync(this.onSync.bind(this));
        this.app.onQuery(this.onQuery.bind(this));
        this.app.onExecute(this.onExecute.bind(this));
        this.app.onDisconnect(this.onDisconnect.bind(this));

        systemManager.listen((source, details, data) => {
            if (source)
                this.queueReportState(source);
        });
    }

    queueReportState(device: ScryptedDevice) {
        if (!isSyncable(device))
            return;

        if (this.storage.getItem(`link-${device.id}`) !== this.linkTracker)
            return;
        this.reportQueue.add(device.id);
        this.reportStateThrottled();
    }

    async onSync(body: SmartHomeV1SyncRequest, headers: Headers): Promise<SmartHomeV1SyncResponse> {
        const ret: SmartHomeV1SyncResponse = {
            requestId: body.requestId,
            payload: {
                agentUserId: this.agentUserId,
                devices: []
            }
        };

        let newDevices = 0;
        for (const id of Object.keys(systemManager.getSystemState())) {
            const device = systemManager.getDeviceById(id);
            const { type } = device;
            const supportedType = supportedTypes[type];

            if (!supportedType)
                continue;

            if (!isSyncable(device))
                continue;

            const probe = await supportedType.probe(device);
            if (!probe)
                continue;

            ret.payload.devices.push(probe);

            if (this.storage.getItem(`link-${device.id}`) !== this.linkTracker) {
                this.storage.setItem(`link-${device.id}`, this.linkTracker);
                newDevices++;
            }

            if (newDevices >= 10) {
                setTimeout(() => this.requestSync(), 10000);
                break;
            }
        }

        return ret;
    }

    async onQuery(body: SmartHomeV1QueryRequest, headers: Headers): Promise<SmartHomeV1QueryResponse> {
        const ret = {
            requestId: body.requestId,
            payload: {
                devices: {

                }
            }
        }

        for (const input of body.inputs) {
            for (const queryDevice of input.payload.devices) {
                const device = systemManager.getDeviceById(queryDevice.id);
                if (!device) {
                    this.log.e(`query for missing device ${queryDevice.id}`);
                    ret.payload.devices[queryDevice.id] = {
                        online: false,
                    };
                    continue;
                }

                const { type } = device;
                const supportedType = supportedTypes[type];
                if (!supportedType) {
                    this.log.e(`query for unsupported type ${type}`);
                    ret.payload.devices[queryDevice.id] = {
                        online: false,
                    };
                    continue;
                }

                try {
                    const status = await supportedType.query(device);
                    ret.payload.devices[queryDevice.id] = Object.assign({
                        online: true,
                    }, status);
                }
                catch (e) {
                    this.log.e(`query failure for ${device.name}`);
                    ret.payload.devices[queryDevice.id] = {
                        online: false,
                    };
                }
            }
        }

        return ret;
    }

    async onExecute(body: SmartHomeV1ExecuteRequest, headers: Headers): Promise<SmartHomeV1ExecuteResponse> {
        const ret: SmartHomeV1ExecuteResponse = {
            requestId: body.requestId,
            payload: {
                commands: [
                ]
            }
        }
        for (const input of body.inputs) {
            for (const command of input.payload.commands) {
                for (const commandDevice of command.devices) {
                    const device = systemManager.getDeviceById(commandDevice.id);
                    if (!device) {
                        const error: SmartHomeV1ExecuteResponseCommands = {
                            ids: [commandDevice.id],
                            status: 'ERROR',
                            errorCode: 'deviceNotFound',
                        }
                        ret.payload.commands.push(error);
                        continue;
                    }

                    for (const execution of command.execution) {
                        const commandHandler = commandHandlers[execution.command]
                        if (!commandHandler) {
                            const error: SmartHomeV1ExecuteResponseCommands = {
                                ids: [commandDevice.id],
                                status: 'ERROR',
                                errorCode: 'functionNotSupported',
                            }
                            ret.payload.commands.push(error);
                            continue;
                        }

                        try {
                            const result = await commandHandler(device, execution);
                            ret.payload.commands.push(result);
                        }
                        catch (e) {
                            const error: SmartHomeV1ExecuteResponseCommands = {
                                ids: [commandDevice.id],
                                status: 'ERROR',
                                errorCode: 'hardError',
                            }
                            ret.payload.commands.push(error);
                        }
                    }
                }
            }
        }

        return ret;
    }

    async onDisconnect(body: SmartHomeV1DisconnectRequest, headers: Headers): Promise<SmartHomeV1DisconnectResponse> {
        localStorage.setItem('disconnected', '');
        return {
        }
    }

    async reportState() {
        const reporting = new Set(this.reportQueue);
        this.reportQueue.clear();

        const report: SmartHomeV1ReportStateRequest = {
            requestId: uuidv4(),
            agentUserId: this.agentUserId,
            payload: {
                devices: {
                    states: {
                    }
                }
            }
        };

        for (const id of reporting) {
            const device = systemManager.getDeviceById(id);
            if (!device)
                continue;
            const { type } = device;
            const supportedType = supportedTypes[type];
            if (!supportedType)
                continue;
            try {
                const status = await supportedType.query(device);
                report.payload.devices.states[id] = Object.assign({
                    online: true,
                }, status);
            }
            catch (e) {
                report.payload.devices.states[id] = {
                    online: false,
                }
            }
        }

        if (!Object.keys(report.payload.devices.states).length)
            return;

        this.log.i('reporting state:');
        this.log.i(JSON.stringify(report, undefined, 2));
        if (this.app.jwt) {
            const result = await this.app.reportState(report);
            this.log.i('report state result:')
            this.log.i(result);
            return;
        }

        const plugins = await systemManager.getComponent('plugins');
        const id = await plugins.getIdForPluginId('@scrypted/cloud');
        const cloudStorage = await plugins.getStorage(id);
        if (!cloudStorage?.token_info) {
            this.log.w('Unable to report state to Google, no JWT token was provided and Scrypted Cloud is not installed/configured.');
            return;
        }
        const { token_info } = cloudStorage;
        const response = await axios.post('https://home.scrypted.app/_punch/reportState', report, {
            headers: {
                Authorization: `Bearer ${token_info}`
            },
        });
        this.log.i('report state result:');
        this.log.i(JSON.stringify(response.data));
    }

    async requestSync() {
        if (this.app.jwt) {
            this.app.requestSync(this.agentUserId);
            return;
        }

        const plugins = await systemManager.getComponent('plugins');
        const id = await plugins.getIdForPluginId('@scrypted/cloud');
        const cloudStorage = await plugins.getStorage(id);
        if (!cloudStorage?.token_info) {
            this.log.w('Unable to request Google sync, no JWT token was provided and Scrypted Cloud is not installed/configured.');
            return;
        }
        const { token_info } = cloudStorage;
        const response = await axios(`https://home.scrypted.app/_punch/requestSync?agentUserId=${this.agentUserId}`, {
            headers: {
                Authorization: `Bearer ${token_info}`
            }
        });
        this.log.i('request sync result:');
        this.log.i(JSON.stringify(response.data));
    }

    async onRequest(request: HttpRequest, response: HttpResponse): Promise<void> {
        const body = JSON.parse(request.body);
        const result = await this.app.handler(body, request.headers as Headers);
        response.send(JSON.stringify(result.body), {
            headers: result.headers,
            code: result.status,
        })
    }
    getEndpoint(): string {
        throw new Error('Method not implemented.');
    }
}

export default new GoogleHome();
