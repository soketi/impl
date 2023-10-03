/* import {
    type Connection,
    type RemoteConnection,
} from '@soketi/impl-interfaces';
import type { PresenceMember } from './channels';

export interface PusherConnection<
    ID extends string = string,
> extends Connection<ID> {
    readonly subscribedChannels: Set<string>;
    readonly presence: Map<string, PresenceMember>;
    readonly channels: Map<string, Set<string>>;

    user: JSON.Object|null;
    userAuthenticationTimeout?: NodeJS.Timeout;

    addToChannel(conn: PusherConnection<ID>, channel: string): Promise<number>;
    removeFromChannels(conn: PusherConnection<ID>, channel: string|string[]): Promise<number|void>;

    subscribeToChannel(conn: PusherConnection<ID>, message: Message): Promise<void>;
    unsubscribeFromAllChannels(conn: PusherConnection<ID>, message: Message): Promise<void>;
    unsubscribeFromChannel(conn: PusherConnection<ID>, channel: string): Promise<void>;
    handleClientEvent(conn: PusherConnection<ID>, message: Message): Promise<void>;
    handleSignin(conn: PusherConnection<ID>, message: Message): Promise<void>;

    getConnections(forceLocal?: boolean): Promise<Map<string, PusherConnection<ID>|PusherRemoteConnection<ID>>>;
    isInChannel(connId: string, channel: string, forceLocal?: boolean): Promise<boolean>;
    getConnectionsCount(forceLocal?: boolean): Promise<number>;
    getChannels(forceLocal?: boolean): Promise<Map<string, Set<string>>>;
    getChannelsWithConnectionsCount(forceLocal?: boolean): Promise<Map<string, number>>;
    getChannelConnections(channel: string, forceLocal?: boolean): Promise<Map<string, Connection<ID>|PusherRemoteConnection<ID>>>;
    getChannelConnectionsCount(channel: string, forceLocal?: boolean): Promise<number>;
    getChannelConnectionsCount(channel: string, forceLocal?: boolean): Promise<number>;
    getChannelMembers(channel: string, forceLocal?: boolean): Promise<Map<string, PresenceMemberInfo>>;
    getChannelMembersCount(channel: string, forceLocal?: boolean): Promise<number>;
}
 */

/*

    type PusherConnections<
        ID extends string = ConnectionID,
    > = WS.Connections<ConnectionID> & {
        readonly started: Date;
        readonly channels: Map<string, Set<string>>;

        addToChannel(conn: PusherConnection<ID>, channel: string): Promise<number>;
        removeFromChannels(conn: PusherConnection<ID>, channel: string|string[]): Promise<number|void>;

        subscribeToChannel(conn: PusherConnection<ID>, message: Message): Promise<void>;
        unsubscribeFromAllChannels(conn: PusherConnection<ID>, message: Message): Promise<void>;
        unsubscribeFromChannel(conn: PusherConnection<ID>, channel: string): Promise<void>;
        handleClientEvent(conn: PusherConnection<ID>, message: Message): Promise<void>;
        handleSignin(conn: PusherConnection<ID>, message: Message): Promise<void>;

        getConnections(forceLocal?: boolean): Promise<Map<string, PusherConnection<ID>|PusherRemoteConnection<ID>>>;
        isInChannel(connId: string, channel: string, forceLocal?: boolean): Promise<boolean>;
        getConnectionsCount(forceLocal?: boolean): Promise<number>;
        getChannels(forceLocal?: boolean): Promise<Map<string, Set<string>>>;
        getChannelsWithConnectionsCount(forceLocal?: boolean): Promise<Map<string, number>>;
        getChannelConnections(channel: string, forceLocal?: boolean): Promise<Map<string, PusherConnection<ID>|PusherRemoteConnection<ID>>>;
        getChannelConnectionsCount(channel: string, forceLocal?: boolean): Promise<number>;
        getChannelConnectionsCount(channel: string, forceLocal?: boolean): Promise<number>;
        getChannelMembers(channel: string, forceLocal?: boolean): Promise<Map<string, Presence.PresenceMemberInfo>>;
        getChannelMembersCount(channel: string, forceLocal?: boolean): Promise<number>;
        send(channel: string, data: SentMessage, exceptingId: string|null, forceLocal?: boolean): Promise<void>;
    }

    namespace Apps {
        type WebhookInterface = {
            url?: string;
            headers?: JSON.Object;
            lambda_function?: string;
            event_types: string[];
            filter?: {
                channel_name_starts_with?: string;
                channel_name_ends_with?: string;
            }
            lambda?: {
                async?: boolean;
                region?: string;
                client_options?: {
                    credentials?: any;
                    endpoint?: string;
                    version?: string;
                }
            }
        }

        type ChannelMessageLimitsInterface = {
            pattern: string;
            maxMessages: number;
        }

        type Scheme = {
            id?: string;
            key?: string;
            secret?: string;
            enableUserAuthentication?: boolean;
            userAuthenticationTimeout?: number;
            enableClientMessages?: boolean;
            enabled?: boolean;
            enableMetrics?: boolean;
            maxConnections?: string|number;
            maxBackendEventsPerSecond?: string|number;
            maxClientEventsPerSecond?: string|number;
            maxReadRequestsPerSecond?: string|number;
            webhooks?: WebhookInterface[];
            maxPresenceMembersPerChannel?: number;
            maxPresenceMemberSizeInKb?: number;
            maxChannelNameLength?: number;
            maxEventChannelsAtOnce?: number;
            maxEventNameLength?: number;
            maxEventPayloadInKb?: number;
            maxEventBatchSize?: number;
        }

        type App = {
            hasClientEventWebhooks?: boolean;
            hasChannelOccupiedWebhooks?: boolean;
            hasChannelVacatedWebhooks?: boolean;
            hasMemberAddedWebhooks?: boolean;
            hasMemberRemovedWebhooks?: boolean;
            hasCacheMissedWebhooks?: boolean;
            toObject(): AppScheme;
            calculateBodyMd5(body: string): Promise<string>;
            createToken(params: string): Promise<string>;
            sha256(): Promise<string>;
            calculateRequestToken(
                params: { [key: string]: string },
                method: string,
                path: string,
                body?: string,
            ): Promise<string>;
            calculateSigninToken(connId: string, userData: string): Promise<string>;
            signinTokenIsValid(connId: string, userData: string, receivedToken: string): Promise<boolean>;
        } & AppScheme;
    }

    namespace Gossip {
        type GossipResponse = {
            channels?: [string, string[]][];
            remoteInstanceIds?: string[];
            channelsWithSocketsCount?: [string, number][];
            connections?: PusherRemoteConnection[];
            exists?: boolean;
            totalCount?: number;
            members?: [string, Presence.PresenceMemberInfo][];
        }

        type GossipDataOptions = {
            appId?: string;
            channel?: string;
            connId?: string;
            sentMessage?: string;
            exceptingId?: string|null;
            amount?: number;
            userId?: UserID;
        }

        type GossipData = {
            methodToCall: string;
            options?: GossipDataOptions;
        }
    }

    namespace Webhooks {
        type ClientEventData = {
            name: string;
            channel: string;
            event?: string,
            data?: {
                [key: string]: any;
            };
            socket_id?: string;
            user_id?: string;
            time_ms?: number;
        }

        type ClientEventQueueMessage = {
            appKey: string;
            appId: string;
            payload: {
                time_ms: number;
                events: ClientEventData[];
            },
            originalPusherSignature: string;
        }
    }
 */

export type AnyPusherEvent = PusherEvent<any, any, any>;

export type AnyPusherSubscriptionEvent = PusherSubscribeToPublic|PusherSubscribeToPrivate|PusherSubscribeToPresence;
export type AnyPusherSubscriptionResponse = PusherSubscriptionSucceeded|PusherSubscriptionError;

export type AnyPusherEventFromBroadcast = PusherClientEvent|PusherHttpEvent;

export type AnyPusherEventFromServer = PusherPong
    |PusherConnectionEstablished
    |AnyPusherSubscriptionResponse
    |PusherMemberRemoved
    |PusherMemberAdded
    |PusherError
    |PusherCacheMiss
    |PusherSubscriptionCount
    |PusherSigninSuccess
    |AnyPusherEventFromBroadcast;

export type AnyPusherBroadcastableEvent = PusherMemberAdded
    |PusherMemberRemoved
    |AnyPusherEventFromBroadcast
    |PusherSubscriptionCount;

export type AnyPusherEventFromConnection = PusherPing
    |AnyPusherSubscriptionEvent
    |PusherUnsubscribe
    |PusherSignin
    |PusherClientEvent;

export type AnyPusherPingPong = PusherPing|PusherPong;

export type PusherEvent<Data, Key = string, Extra = Partial<Record<string, unknown>>> = {
    event: Key;
    data: Data;
} & Extra;

export type PusherPing = PusherEvent<string, 'pusher:ping'>;
export type PusherPong = PusherEvent<string, 'pusher:pong'>;

export type PusherConnectionEstablished = PusherEvent<string, 'pusher:connection_established'>;

export type PusherSubscribeToPublic = PusherEvent<{
    channel: string,
}, 'pusher:subscribe'>;

export type PusherSubscribeToPrivate = PusherEvent<{
    auth: string;
    channel: string;
    shared_secret?: string;
}, 'pusher:subscribe'>;

export type PusherSubscribeToPresence = PusherEvent<{
    auth: string;
    channel_data: string;
    channel: string;
}, 'pusher:subscribe'>;

export type PusherSubscriptionSucceeded = PusherEvent<
    string,
    'pusher_internal:subscription_succeeded',
    { channel: string }
>;

export type PusherSubscriptionError = PusherEvent<{
    type: string;
    error: string;
    status: number;
}, 'pusher:subscription_error', { channel: string }>;

export type PusherMemberRemoved = PusherEvent<
    string,
    'pusher_internal:member_removed',
    { channel: string }
>;

export type PusherMemberAdded = PusherEvent<
    string,
    'pusher_internal:member_added',
    { channel: string }
>;

export type PusherUnsubscribe = PusherEvent<{
    channel: string;
}, 'pusher:unsubscribe'>;

export type PusherSignin = PusherEvent<{
    auth: string;
    user_data: string;
}, 'pusher:signin'>;

export type PusherSigninSuccess = PusherEvent<{
    user_data: string;
}, 'pusher:signin_success'>;

export type PusherError = PusherEvent<{
    message: string;
    code: number;
}, 'pusher:error'>;

export type PusherCacheMiss = PusherEvent<{
    //
}, 'pusher:cache_miss'>;

export type PusherSubscriptionCount = PusherEvent<{
    subscription_count: number;
}, 'pusher:subscription_count', { channel: string }>;

export type PusherClientEvent = PusherEvent<
    Record<string, any>,
    string,
    { channel: string }
>;

export type PusherHttpEvent = PusherEvent<string, string, {
    channel: string;
    socket_id?: string;
}>;

export * as Apps from './apps';
export * as Channels from './channels';
export * as Gossiper from './gossiper';
// export * from './queue';
// export * from './rest';
export * as WS from './ws';
