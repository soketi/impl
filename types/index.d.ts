export declare namespace JSON {
    type Value = Date|RegExp|string|number|boolean|null|JSON.Object;
    type Object = JSON.Value[]|{ [key: string]: JSON.Value };
}

export namespace Gossip {
    type Payload = JSON.Object|JSON.Value;
    type ResponseHandler = (msg: Gossip.Message) => Promise<Gossip.Payload>;
    type ResponseHandlers = { [topic: string]: ResponseHandler; };
    type Message = {
        topic: string;
        data: JSON.Value;
    }
}

export declare namespace WS {
    type ConnectionID = string;
    type Message = JSON.Object|string;

    type Connection = {
        id: ConnectionID;
        connection: WebSocket;
        closed: boolean;
        sendJson(message: Message): Promise<void>;
        sendError(message: Message, code?: number, reason?: string): Promise<void>;
        close(code?: number, reason?: string): Promise<void>;
        toRemote(shard: string): RemoteConnection;
    }

    type RemoteConnection = {
        id: ConnectionID;
    }
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

        type Connections = {
            addToChannel(conn: PusherConnection, channel: string): Promise<number>;
            removeFromChannel(conn: PusherConnection, channel: string|string[]): Promise<number|void>;
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
            signingTokenFromRequest(request: Request, env: Pusher.PusherEnvironment): Promise<string>;
            createToken(params: string): Promise<string>;
            sha256(): Promise<string>;
        } & AppScheme;
    }
}
