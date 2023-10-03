import { type PusherEnvironment } from '../pusher-utils';
import type { WebhookInterface } from './webhook';

export function transformPotentialJsonToArray<
    Input = unknown,
    Output = unknown,
>(potentialJson: Input): Promise<Output>|Output {
    if (potentialJson instanceof Array) {
        return potentialJson as Output;
    }

    try {
        let potentialArray = JSON.parse(potentialJson as string);

        if (potentialArray instanceof Array) {
            return potentialArray as Output;
        }
    } catch (e) {
        //
    }

    return [] as Output;
}

export type AppSchema = {
    id: string;
    key: string;
    secret: string;
    enableUserAuthentication: boolean;
    userAuthenticationTimeout: number;
    enableClientMessages: boolean;
    enableMetrics: boolean;
    enabled: boolean;
    maxConnections: number;
    maxBackendEventsPerSecond: number;
    maxClientEventsPerSecond: number;
    maxReadRequestsPerSecond: number;
    webhooks: WebhookInterface[];
    maxPresenceMembersPerChannel: number;
    maxPresenceMemberSizeInKb: number;
    maxChannelNameLength: number;
    maxEventChannelsAtOnce: number;
    maxEventNameLength: number;
    maxEventPayloadInKb: number;
    maxEventBatchSize: number;
}

export type AppSchemaKey = keyof AppSchema;

export type AppLoadSchemaInput<Output, Input = any> = {
    default: Output|((env?: PusherEnvironment) => Output|Promise<Output>);
    parameters: string[];
    parsers?: ((value: Input|Output) => Output|Promise<Output>)[];
}

export type AppLoadSchemaDefinition = {
    [AppSchemaKey in keyof AppSchema]: AppLoadSchemaInput<
        AppSchema[AppSchemaKey]
    >;
}

export const schema: AppLoadSchemaDefinition = {
    id: {
        default: 'app-id',
        parameters: ['id'],
        parsers: [String],
    },
    key: {
        default: 'app-key',
        parameters: ['key'],
        parsers: [String],
    },
    secret: {
        default: 'app-secret',
        parameters: ['secret'],
        parsers: [String],
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
        default: [],
        parameters: ['webhooks'],
        parsers: [
            transformPotentialJsonToArray<string|WebhookInterface[], WebhookInterface[]>,
        ],
    },
    maxPresenceMembersPerChannel: {
        default: (env?: PusherEnvironment) => env?.PRESENCE_MAX_MEMBERS || 100,
        parameters: ['maxPresenceMembersPerChannel'],
        parsers: [parseInt],
    },
    maxPresenceMemberSizeInKb: {
        default: (env?: PusherEnvironment) => env?.PRESENCE_MAX_MEMBER_SIZE || 2,
        parameters: ['maxPresenceMemberSizeInKb'],
        parsers: [parseFloat],
    },
    maxChannelNameLength: {
        default: (env?: PusherEnvironment) => env?.CHANNEL_LIMITS_MAX_NAME_LENGTH || 200,
        parameters: ['maxChannelNameLength'],
        parsers: [parseInt],
    },
    maxEventChannelsAtOnce: {
        default: (env?: PusherEnvironment) => env?.EVENT_MAX_CHANNELS_AT_ONCE || 100,
        parameters: ['maxEventChannelsAtOnce'],
        parsers: [parseInt],
    },
    maxEventNameLength: {
        default: (env?: PusherEnvironment) => env?.EVENT_MAX_NAME_LENGTH || 200,
        parameters: ['maxEventNameLength'],
        parsers: [parseInt],
    },
    maxEventPayloadInKb: {
        default: (env?: PusherEnvironment) => env?.EVENT_MAX_SIZE_IN_KB || 100,
        parameters: ['maxEventPayloadInKb'],
        parsers: [parseFloat],
    },
    maxEventBatchSize: {
        default: (env?: PusherEnvironment) => env?.EVENT_MAX_BATCH_SIZE || 10,
        parameters: ['maxEventBatchSize'],
        parsers: [parseInt],
    },
};
