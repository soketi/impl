import type * as FN from '@soketi/impl/types';

export abstract class App implements FN.Pusher.PusherApps.App {
    id: string;
    key: string;
    secret: string;

    enableUserAuthentication?: boolean;
    userAuthenticationTimeout?: number;
    enableClientMessages: boolean;
    enableMetrics: boolean;
    enabled: boolean;

    maxConnections: string|number;
    maxBackendEventsPerSecond: string|number;
    maxClientEventsPerSecond: string|number;
    maxReadRequestsPerSecond: string|number;

    maxPresenceMembersPerChannel: number;
    maxPresenceMemberSizeInKb: number;

    maxChannelNameLength: number;
    maxEventChannelsAtOnce: number;
    maxEventNameLength: number;
    maxEventPayloadInKb: number;
    maxEventBatchSize: number;

    webhooks: FN.Pusher.PusherApps.WebhookInterface[];
    channelMessageLimits: FN.Pusher.PusherApps.ChannelMessageLimitsInterface[];

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

    static readonly schema = {
        id: {
            default: 'app-id',
            parameters: ['id'],
        },
        key: {
            default: 'app-key',
            parameters: ['key'],
        },
        secret: {
            default: 'app-secret',
            parameters: ['secret'],
        },
        enableUserAuthentication: {
            default: false,
            parameters: ['enableUserAuthentication'],
            parsers: [Boolean],
        },
        userAuthenticationTimeout: {
            default: 10_000,
            parameters: ['userAuthenticationTimeout'],
            parsers: [parseInt],
        },
        enableClientMessages: {
            default: false,
            parameters: ['enableClientMessages'],
            parsers: [Boolean],
        },
        enableMetrics: {
            default: false,
            parameters: ['enableMetrics'],
            parsers: [Boolean],
        },
        enabled: {
            default: true,
            parameters: ['enabled'],
            parsers: [Boolean],
        },
        maxConnections: {
            default: -1,
            parameters: ['maxConnections'],
            parsers: [parseInt],
        },
        maxBackendEventsPerSecond: {
            default: -1,
            parameters: ['maxBackendEventsPerSecond'],
            parsers: [parseInt],
        },
        maxClientEventsPerSecond: {
            default: -1,
            parameters: ['maxClientEventsPerSecond'],
            parsers: [parseInt],
        },
        maxReadRequestsPerSecond: {
            default: -1,
            parameters: ['maxReadRequestsPerSecond'],
            parsers: [parseInt],
        },
        webhooks: {
            default: '[]',
            parameters: ['webhooks'],
            parsers: [
                'transformPotentialJsonToArray',
            ],
        },
        channelMessageLimits: {
            default: '[]',
            parameters: ['channelMessageLimits'],
            parsers: [
                'transformPotentialJsonToArray',
            ],
        },
        maxPresenceMembersPerChannel: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.PRESENCE_MAX_MEMBERS || 100,
            parameters: ['maxPresenceMembersPerChannel'],
            parsers: [parseInt],
        },
        maxPresenceMemberSizeInKb: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.PRESENCE_MAX_MEMBER_SIZE || 2,
            parameters: ['maxPresenceMemberSizeInKb'],
            parsers: [parseFloat],
        },
        maxChannelNameLength: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.CHANNEL_LIMITS_MAX_NAME_LENGTH || 200,
            parameters: ['maxChannelNameLength'],
            parsers: [parseInt],
        },
        maxEventChannelsAtOnce: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.EVENT_MAX_CHANNELS_AT_ONCE || 100,
            parameters: ['maxEventChannelsAtOnce'],
            parsers: [parseInt],
        },
        maxEventNameLength: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.EVENT_MAX_NAME_LENGTH || 200,
            parameters: ['maxEventNameLength'],
            parsers: [parseInt],
        },
        maxEventPayloadInKb: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.EVENT_MAX_SIZE_IN_KB || 100,
            parameters: ['maxEventPayloadInKb'],
            parsers: [parseFloat],
        },
        maxEventBatchSize: {
            default: (env?: FN.Pusher.PusherEnvironment) => env?.EVENT_MAX_BATCH_SIZE || 10,
            parameters: ['maxEventBatchSize'],
            parsers: [parseInt],
        },
    };

    constructor(app: FN.Pusher.PusherApps.AppScheme = {}, protected env?: FN.Pusher.PusherEnvironment) {
        this.loadVariablesFromObject(app, env);

        this.hasClientEventWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CLIENT_EVENT_WEBHOOK)).length > 0;
        this.hasChannelOccupiedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CHANNEL_OCCUPIED_WEBHOOK)).length > 0;
        this.hasChannelVacatedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CHANNEL_VACATED_WEBHOOK)).length > 0;
        this.hasMemberAddedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.MEMBER_ADDED_WEBHOOK)).length > 0;
        this.hasMemberRemovedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.MEMBER_REMOVED_WEBHOOK)).length > 0;
        this.hasCacheMissedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CACHE_MISSED_WEBHOOK)).length > 0;
    }

    protected loadVariablesFromObject(object: FN.Pusher.PusherApps.AppScheme, env?: FN.Pusher.PusherEnvironment): void {
        for (let key in App.schema) {
            let def = App.schema[key];

            for (let parameter of def.parameters) {
                let value = object[parameter] || (
                    typeof def.default === 'function'
                        ? def.default(env)
                        : def.default
                );

                if (def.parsers && def.parsers.length > 0) {
                    for (let parser of def.parsers) {
                        if (typeof parser === 'string') {
                            value = this[parser](value);
                        }

                        if (typeof parser === 'function') {
                            value = parser(value);
                        }
                    }
                }

                this[key] = value;
            }
        }
    }

    toObject(): FN.Pusher.PusherApps.AppScheme {
        let app: FN.Pusher.PusherApps.AppScheme = {};

        for (let key in App.schema) {
            app[key] = this[key];
        }

        return app;
    }

    abstract calculateBodyMd5(body: string): Promise<string>;
    abstract createToken(params: string): Promise<string>;
    abstract sha256(): Promise<string>;

    async calculateRequestToken(
        params: { [key: string]: string },
        method: string,
        path: string,
        body?: string,
    ): Promise<string> {
        params['auth_key'] = this.key;

        delete params['auth_signature'];
        delete params['body_md5']
        delete params['appId'];
        delete params['appKey'];
        delete params['channelName'];

        if (body) {
            params['body_md5'] = await this.calculateBodyMd5(body);
        }

        return await this.createToken([method, path, App.toOrderedArray(params).join('&')].join("\n"));
    }

    async calculateSigninToken(connId: string, userData: string): Promise<string> {
        return await this.createToken(`${connId}::user::${userData}`);
    }

    async signinTokenIsValid(connId: string, userData: string, receivedToken: string): Promise<boolean> {
        return `${this.key}:${await this.calculateSigninToken(connId, userData)}` === receivedToken;
    }

    protected transformPotentialJsonToArray(potentialJson: any): any {
        if (potentialJson instanceof Array) {
            return potentialJson;
        }

        try {
            let potentialArray = JSON.parse(potentialJson);

            if (potentialArray instanceof Array) {
                return potentialArray;
            }
        } catch (e) {
            //
        }

        return [];
    }

    protected static toOrderedArray(map): string[] {
        return Object.keys(map)
            .map((key) => [key, map[key]])
            .sort((a, b) => {
                if (a[0] < b[0]) {
                    return -1;
                }

                if (a[0] > b[0]) {
                    return 1;
                }

                return 0;
            })
            .map((pair) => pair[0] + "=" + pair[1]);
    }
}
