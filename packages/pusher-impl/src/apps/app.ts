import type { WebhookInterface } from './webhook';
import { type PusherEnvironment, PusherUtils } from '../pusher-utils';
import { Token } from '../token';
import { createHmac } from 'crypto';

import {
    schema,
    type AppSchema,
    type AppSchemaKey,
} from './schema';

export class App implements Partial<AppSchema> {
    id?: string;
    key?: string;
    secret?: string;

    enableUserAuthentication?: boolean;
    userAuthenticationTimeout?: number;
    enableClientMessages?: boolean;
    enableMetrics?: boolean;
    enabled?: boolean;

    maxConnections?: number;
    maxBackendEventsPerSecond?: number;
    maxClientEventsPerSecond?: number;
    maxReadRequestsPerSecond?: number;

    maxPresenceMembersPerChannel?: number;
    maxPresenceMemberSizeInKb?: number;

    maxChannelNameLength?: number;
    maxEventChannelsAtOnce?: number;
    maxEventNameLength?: number;
    maxEventPayloadInKb?: number;
    maxEventBatchSize?: number;

    webhooks?: WebhookInterface[];

    hasClientEventWebhooks = false;
    hasChannelOccupiedWebhooks = false;
    hasChannelVacatedWebhooks = false;
    hasMemberAddedWebhooks = false;
    hasMemberRemovedWebhooks = false;
    hasCacheMissedWebhooks = false;

    static readonly CLIENT_EVENT_WEBHOOK = 'client_event';
    static readonly CHANNEL_OCCUPIED_WEBHOOK = 'channel_occupied';
    static readonly CHANNEL_VACATED_WEBHOOK = 'channel_vacated';
    static readonly MEMBER_ADDED_WEBHOOK = 'member_added';
    static readonly MEMBER_REMOVED_WEBHOOK = 'member_removed';
    static readonly CACHE_MISSED_WEBHOOK = 'cache_miss';

    constructor(
        protected env?: PusherEnvironment,
    ) {
        //
    }

    static async load(
        object: any,
        env?: PusherEnvironment,
    ): Promise<Required<App>> {
        const app = new this(env) as App;
        const defKeys = Object.keys(schema) as AppSchemaKey[];

        for await (const key of defKeys) {
            const def = schema[key as AppSchemaKey] as typeof schema[AppSchemaKey];

            for  (let parameter of def.parameters) {
                let value: AppSchema[AppSchemaKey] = object[parameter as AppSchemaKey] as unknown as AppSchema[AppSchemaKey] || (
                    typeof def.default === 'function'
                        ? await def.default(env)
                        : def.default
                );

                if (def.parsers && def.parsers.length > 0) {
                    for (let parser of def.parsers) {
                        if (typeof parser === 'function') {
                            value = await parser(value);
                        }
                    }
                }

                app[key as AppSchemaKey] = value as any;
            }
        }

        await app.loadWebhooks();

        return app as Required<App>;
    }

    async loadWebhooks(): Promise<void> {
        const app: Required<App> = this as Required<App>;

        this.hasClientEventWebhooks = app.webhooks.filter(webhook => webhook.event_types.includes(App.CLIENT_EVENT_WEBHOOK)).length > 0;
        this.hasChannelOccupiedWebhooks = app.webhooks.filter(webhook => webhook.event_types.includes(App.CHANNEL_OCCUPIED_WEBHOOK)).length > 0;
        this.hasChannelVacatedWebhooks = app.webhooks.filter(webhook => webhook.event_types.includes(App.CHANNEL_VACATED_WEBHOOK)).length > 0;
        this.hasMemberAddedWebhooks = app.webhooks.filter(webhook => webhook.event_types.includes(App.MEMBER_ADDED_WEBHOOK)).length > 0;
        this.hasMemberRemovedWebhooks = app.webhooks.filter(webhook => webhook.event_types.includes(App.MEMBER_REMOVED_WEBHOOK)).length > 0;
        this.hasCacheMissedWebhooks = app.webhooks.filter(webhook => webhook.event_types.includes(App.CACHE_MISSED_WEBHOOK)).length > 0;
    }

    toObject(): AppSchema {
        let app: Partial<AppSchema> = {};
        const appObject: App = this as App;

        for (const key of Object.keys(schema)) {
            app[key as AppSchemaKey] = appObject[key as AppSchemaKey] as any;
        }

        return app as AppSchema;
    }

    async calculateBodyMd5(body: string): Promise<string> {
        return PusherUtils.getMD5(body);
    }

    async createToken(params: string): Promise<string> {
        return (new Token(this.key as string, this.secret as string)).sign(params);
    }

    async sha256(): Promise<string> {
        const appObject: App = this as App;
        return createHmac('sha256', appObject.secret as string)
            .update(JSON.stringify(this.toObject()))
            .digest('hex');
    }

    async calculateRequestToken(
        params: { [key: string]: string },
        method: string,
        path: string,
        body?: string,
    ): Promise<string> {
        const appObject: App = this as App;
        params['auth_key'] = appObject.key as any;

        delete params['auth_signature'];
        delete params['body_md5']
        delete params['appId'];
        delete params['appKey'];
        delete params['channelName'];

        if (body) {
            params['body_md5'] = await appObject.calculateBodyMd5(body);
        }

        return await this.createToken([
            method,
            path,
            PusherUtils.toOrderedArray(params).join('&'),
        ].join("\n"));
    }

    async calculateSigninToken(connId: string, userData: string): Promise<string> {
        return await this.createToken(`${connId}::user::${userData}`);
    }

    async signinTokenIsValid(connId: string, userData: string, receivedToken: string): Promise<boolean> {
        return `${this.key}:${await this.calculateSigninToken(connId, userData)}` === receivedToken;
    }
}
