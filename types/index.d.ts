export declare namespace JSON {
    type Value = Date|RegExp|string|number|boolean|null|JSON.Object|any;
    type Object = { [key: string]: JSON.Value; };
    type Array = JSON.Value[]|JSON.Object[];
}

export namespace Gossip {
    type Response = JSON.Object|JSON.Array|JSON.Value;
    type ResponseHandler = (msg: Gossip.Payload) => Promise<Gossip.Response>;
    type ResponseHandlers = { [topic: string]: ResponseHandler; };
    type Payload = JSON.Object|JSON.Array|JSON.Value;
}

export namespace Brain {
    type BrainRecord = {
        value: JSON.Value;
        ttlSeconds: number;
        setTime: number;
    };
}

export declare namespace WS {
    type ConnectionID = string;
    type Message = JSON.Object|JSON.Array|JSON.Value;

    type Connection = {
        id: ConnectionID;
        connection: SoketiNativeWebsocket;
        closed: boolean;
        send(message: (ArrayBuffer|ArrayBufferView)|string): Promise<void>;
        sendJson(message: Message): Promise<void>;
        sendError(message: Message, code?: number, reason?: string): Promise<void>;
        close(code?: number, reason?: string): Promise<void>;
        toRemote(remoteInstanceId?: string): RemoteConnection;
    }

    type RemoteConnection = {
        id: ConnectionID;
    }

    type Connections = {
        readonly connections: Map<string, Connection>;
        newConnection(conn: Connection): Promise<void>;
        removeConnection(conn: Connection): Promise<void>;
    }

    type SoketiNativeWebsocket = {
        send(message: (ArrayBuffer | ArrayBufferView) | string): void;
        close(code?: number, reason?: string): void;
    }
}

export declare namespace Webhooks {
    type WebhookPayload = JSON.Object;
}

export declare namespace Queue {
    type Job = {
        id: string;
        queue: string;
        data: JobData;
    }

    type JobData = JSON.Object;
}

export declare namespace Pusher {
    type PusherEnvironment = {
        [key: string]: string;
    };

    namespace PusherWS {
        type PusherConnection = {
            subscribedChannels: Set<string>;
            presence: Map<string, Presence.PresenceMember>;
            handlePong(): Promise<void>;
            updateTimeout(): Promise<void>;
        } & WS.Connection;

        type PusherRemoteConnection = {
            subscribedChannels: string[];
            presence: {
                channel: string;
                member: Presence.PresenceMember;
            }[];
        } & WS.RemoteConnection;

        namespace Presence {
            type PresenceMemberInfo = JSON.Object;
            type PresenceMember = {
                user_id: number|string;
                user_info: PresenceMemberInfo;
                socket_id?: string;
            }
        }

        type PusherMessageData = {
            channel_data?: string;
            channel?: string;
            [key: string]: any;
        }

        type PusherMessage = {
            event?: string;
            name?: string;
            channel?: string;
            data?: PusherMessageData;
        }

        type SentPusherMessage = {
            event?: string;
            channel?: string;
            data?: PusherMessageData|string;
        }

        type PusherConnections = WS.Connections & {
            readonly started: Date;
            readonly channels: Map<string, Set<string>>;

            addToChannel(conn: PusherConnection, channel: string): Promise<number>;
            removeFromChannels(conn: PusherConnection, channel: string|string[]): Promise<number|void>;

            subscribeToChannel(conn: PusherConnection, message: PusherWS.PusherMessage): Promise<void>;
            unsubscribeFromAllChannels(conn: PusherConnection, message: PusherWS.PusherMessage): Promise<void>;
            unsubscribeFromChannel(conn: PusherConnection, channel: string): Promise<void>;
            handleClientEvent(conn: PusherConnection, message: PusherWS.PusherMessage): Promise<void>;

            getConnections(forceLocal?: boolean): Promise<Map<string, PusherWS.PusherConnection|PusherRemoteConnection>>;
            isInChannel(connId: string, channel: string, forceLocal?: boolean): Promise<boolean>;
            getConnectionsCount(forceLocal?: boolean): Promise<number>;
            getChannels(forceLocal?: boolean): Promise<Map<string, Set<string>>>;
            getChannelsWithConnectionsCount(forceLocal?: boolean): Promise<Map<string, number>>;
            getChannelConnections(channel: string, forceLocal?: boolean): Promise<Map<string, PusherWS.PusherConnection|PusherRemoteConnection>>;
            getChannelConnectionsCount(channel: string, forceLocal?: boolean): Promise<number>;
            getChannelConnectionsCount(channel: string, forceLocal?: boolean): Promise<number>;
            getChannelMembers(channel: string, forceLocal?: boolean): Promise<Map<string, Presence.PresenceMemberInfo>>;
            getChannelMembersCount(channel: string, forceLocal?: boolean): Promise<number>;
            send(channel: string, data: SentPusherMessage, exceptingId: string|null, forceLocal?: boolean): Promise<void>;
        }
    }

    namespace Channels {
        type LeaveResponse = {
            left: boolean;
            remainingConnections?: number;
            member?: PusherWS.Presence.PresenceMember;
        }

        type JoinResponse = {
            conn: PusherWS.PusherConnection;
            success: boolean;
            channelConnections?: number;
            authError?: boolean;
            member?: PusherWS.Presence.PresenceMember;
            errorMessage?: string;
            errorCode?: number;
            type?: string;
        }

        type ChannelManager = {
            join(conn: PusherWS.PusherConnection, channel: string, message?: PusherWS.PusherMessage): Promise<JoinResponse>;
            leave(conn: PusherWS.PusherConnection, channel: string): Promise<LeaveResponse>;
        }

        type PublicChannelManager = ChannelManager;

        type PrivateChannelManager = PublicChannelManager & {
            signatureIsValid(socketId: string, message: PusherWS.PusherMessage, signatureToCheck: string): Promise<boolean>;
            getDataToSignForSignature(socketId: string, message: PusherWS.PusherMessage): string;
        }

        type PresenceChannelManager = PrivateChannelManager;
    }

    namespace PusherApps {
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

        type AppScheme = {
            id?: string;
            key?: string;
            secret?: string;
            enableClientMessages?: boolean;
            enabled?: boolean;
            enableMetrics?: boolean;
            maxConnections?: string|number;
            maxBackendEventsPerSecond?: string|number;
            maxClientEventsPerSecond?: string|number;
            maxReadRequestsPerSecond?: string|number;
            webhooks?: WebhookInterface[];
            channelMessageLimits?: ChannelMessageLimitsInterface[];
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
        } & AppScheme;
    }

    namespace PusherGossip {
        type GossipResponse = {
            channels?: [string, string[]][];
            remoteInstanceIds?: string[];
            channelsWithSocketsCount?: [string, number][];
            connections?: PusherWS.PusherRemoteConnection[];
            exists?: boolean;
            totalCount?: number;
            members?: [string, PusherWS.Presence.PresenceMemberInfo][];
        }

        type GossipDataOptions = {
            channel?: string;
            connId?: string;
            sentPusherMessage?: string;
            exceptingId?: string|null;
            amount?: number;
        }

        type GossipData = {
            methodToCall: string;
            options?: GossipDataOptions;
        }
    }

    namespace PusherWebhooks {
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
}
