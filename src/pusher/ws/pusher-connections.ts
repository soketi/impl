import type * as FN from '@soketi/impl/types';
import { Connections as BaseConnections } from '../../ws';
import { EncryptedPrivateChannelManager, PresenceChannelManager, PrivateChannelManager, PublicChannelManager } from '../channels';
import { PusherConnection, Utils } from '../';
import { Gossiper } from '../../gossiper';

export class PusherConnections extends BaseConnections implements FN.Pusher.PusherWS.PusherConnections {
    readonly started: Date;
    readonly channels: Map<string, Set<string>> = new Map;
    constructor(
        protected app: FN.Pusher.PusherApps.App,
        protected readonly gossiper: Gossiper,
    ) {
        super();

        this.started = new Date;
    }

    async addToChannel(conn: FN.Pusher.PusherWS.PusherConnection, channel: string): Promise<number> {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set);
        }

        conn.subscribedChannels.add(channel);
        this.channels.get(channel).add(conn.id);

        return await this.getChannelConnectionsCount(channel);
    }

    async subscribeToChannel(conn: FN.Pusher.PusherWS.PusherConnection, message: FN.Pusher.PusherWS.PusherMessage): Promise<any> {
        let channel = message.data.channel;
        let channelManager = await this.getChannelManagerFor(channel);
        let maxChannelNameLength = this.app.maxChannelNameLength;

        if (channel.length > maxChannelNameLength) {
            return conn.sendJson({
                event: 'pusher:subscription_error',
                channel,
                data: {
                    type: 'LimitReached',
                    error: `The channel name is longer than the allowed ${maxChannelNameLength} characters.`,
                    status: 4009,
                },
            });
        }

        let response = await channelManager.join(conn, channel, message);

        if (!response.success) {
            let { authError, type, errorMessage, errorCode } = response;

            // For auth errors, send pusher:subscription_error
            if (authError) {
                return conn.sendJson({
                    event: 'pusher:subscription_error',
                    channel,
                    data: {
                        type: 'AuthError',
                        error: errorMessage,
                        status: 401,
                    },
                });
            }

            // Otherwise, catch any non-auth related errors.
            return conn.sendJson({
                event: 'pusher:subscription_error',
                channel,
                data: {
                    type: type,
                    error: errorMessage,
                    status: errorCode,
                },
            });
        }


        // If the connection freshly joined, send the webhook:
        if (response.channelConnections === 1) {
            // TODO: this.webhooks.sendChannelOccupied(channel);
        }

        // For non-presence channels, end with subscription succeeded.
        if (!(channelManager instanceof PresenceChannelManager)) {
            conn.sendJson({
                event: 'pusher_internal:subscription_succeeded',
                channel,
            });

            if (Utils.isCachingChannel(channel)) {
                this.sendMissedCacheIfExists(conn, channel);
            }

            return;
        }

        // Otherwise, prepare a response for the presence channel.
        let { user_id, user_info } = response.member;
        let members = await this.getChannelMembers(channel);
        let member = { user_id, user_info };

        conn.presence.set(channel, member);

        // If the member already exists in the channel, don't resend the member_added event.
        if (!members.has(user_id as string)) {
            await this.send(channel, {
                event: 'pusher_internal:member_added',
                channel,
                data: JSON.stringify({
                    user_id: member.user_id,
                    user_info: member.user_info,
                }),
            }, conn.id);

            members.set(user_id as string, user_info);

            // TODO: this.webhooks.sendMemberAdded(channel, member.user_id as string);
        }

        await conn.sendJson({
            event: 'pusher_internal:subscription_succeeded',
            channel,
            data: JSON.stringify({
                presence: {
                    ids: Array.from(members.keys()),
                    hash: Object.fromEntries(members),
                    count: members.size,
                },
            }),
        });

        if (Utils.isCachingChannel(channel)) {
            this.sendMissedCacheIfExists(conn, channel);
        }
    }

    async unsubscribeFromAllChannels(conn: FN.Pusher.PusherWS.PusherConnection): Promise<void> {
        await Promise.all(
            [...conn.subscribedChannels].map(channel => this.unsubscribeFromChannel(conn, channel))
        );
    }

    async unsubscribeFromChannel(conn: FN.Pusher.PusherWS.PusherConnection, channel: string): Promise<void> {
        let channelManager = await this.getChannelManagerFor(channel);
        let response = await channelManager.leave(conn, channel);
        let member = conn.presence.get(channel);

        if (response.left) {
            // Send presence channel-speific events and delete specific data.
            // This can happen only if the user is connected to the presence channel.
            if (channelManager instanceof PresenceChannelManager && conn.presence.has(channel)) {
                conn.presence.delete(channel);

                let members = await this.getChannelMembers(channel);

                if (!members.has(member.user_id as string)) {
                    await this.send(channel, {
                        event: 'pusher_internal:member_removed',
                        channel,
                        data: JSON.stringify({ user_id: member.user_id }),
                    }, conn.id);

                    // TODO: this.webhooks.sendMemberRemoved(channel, member.user_id as string);
                }
            }

            conn.subscribedChannels.delete(channel);

            if (response.remainingConnections === 0) {
                // TODO: this.webhooks.sendChannelVacated(channel);
            }
        }

        await this.removeFromChannels(conn, channel);
    }

    async removeFromChannels(conn: FN.Pusher.PusherWS.PusherConnection, channel: string|string[]): Promise<number|void> {
        let remove = (channel: string) => {
            this.channels.get(channel)?.delete(conn.id);

            if (this.channels?.get(channel)?.size === 0) {
                this.channels.delete(channel);
            }

            conn.subscribedChannels.delete(channel);
        };

        if (Array.isArray(channel)) {
            for await (let ch of channel) {
                remove(ch);
            }

            return;
        }

        remove(channel);

        return await this.getChannelConnectionsCount(channel);
    }

    async removeConnectionFromAllChannels(conn: FN.Pusher.PusherWS.PusherConnection): Promise<void> {
        await this.removeFromChannels(conn, [...this.channels.keys()]);
    }

    async handleClientEvent(conn: FN.Pusher.PusherWS.PusherConnection, message: FN.Pusher.PusherWS.PusherMessage): Promise<any> {
        let { event, data, channel } = message;

        if (!this.app.enableClientMessages) {
            return conn.sendJson({
                event: 'pusher:error',
                channel,
                data: {
                    code: 4301,
                    message: `The app does not have client messaging enabled.`,
                },
            });
        }

        // Make sure the event name length is not too big.
        let maxEventnameLength = this.app.maxEventNameLength;

        if (event.length > maxEventnameLength) {
            return conn.sendJson({
                event: 'pusher:error',
                channel,
                data: {
                    code: 4301,
                    message: `Event name is too long. Maximum allowed size is ${maxEventnameLength}.`,
                },
            });
        }

        let payloadSizeInKb = await Utils.dataToKilobytes(message.data);
        let maxPayloadSizeInKb = this.app.maxEventPayloadInKb;

        // Make sure the total payload of the message body is not too big.
        if (payloadSizeInKb > maxPayloadSizeInKb) {
            return conn.sendJson({
                event: 'pusher:error',
                channel,
                data: {
                    code: 4301,
                    message: `The event data should be less than ${maxPayloadSizeInKb} KB.`,
                },
            });
        }

        let canBroadcast = await this.isInChannel(conn.id, channel);

        if (!canBroadcast) {
            return;
        }

        // TODO: Rate limiting

        let userId = conn.presence.has(channel) ? conn.presence.get(channel).user_id as string : null;

        let eventMessage = {
            event,
            channel,
            data,
            ...userId ? { user_id: userId } : {},
        };

        await this.send(channel, eventMessage, conn.id);

        // TODO:
        // this.webhooks.sendClientEvent(
        //     channel, event, data, conn.id, userId
        // );
    }

    async getConnections(forceLocal = false): Promise<Map<
        string,
        FN.Pusher.PusherWS.PusherConnection|FN.Pusher.PusherWS.PusherRemoteConnection
    >> {
        if (forceLocal) {
            return Promise.resolve(this.connections as Map<string, FN.Pusher.PusherWS.PusherConnection>);
        }

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getConnections',
                options: {},
            },
        });

        return this.callMethodAggregators.getConnections(gossipResponses);
    }

    async isInChannel(connId: string, channel: string, forceLocal = false): Promise<boolean> {
        if (forceLocal) {
            if (!this.channels.has(channel)) {
                return false;
            }

            return this.channels.get(channel).has(connId);
        }

        let isInLocalChannel = await this.isInChannel(connId, channel, true);

        // If the user exists locally, just skip calling the Gossip protocol.
        if (isInLocalChannel) {
            return true;
        }

        let options: FN.Pusher.PusherGossip.GossipDataOptions = {
            channel,
            connId,
        };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'isInChannel',
                options,
            },
        });

        return this.callMethodAggregators.isInChannel(gossipResponses, options);
    }

    async getConnectionsCount(forceLocal = false): Promise<number> {
        if (forceLocal) {
            return (await this.getConnections(true)).size;
        }

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getConnectionsCount',
                options: {},
            },
        });

        return this.callMethodAggregators.getConnectionsCount(gossipResponses);
    }

    async getChannels(forceLocal = false): Promise<Map<string, Set<string>>> {
        if (forceLocal) {
            return this.channels;
        }

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannels',
                options: {},
            },
        });

        return this.callMethodAggregators.getChannels(gossipResponses);
    }

    async getChannelsWithConnectionsCount(forceLocal = false): Promise<Map<string, number>> {
        if (forceLocal) {
            let list = new Map<string, number>();

            for await (let [channel, connections] of [...await this.getChannels(true)]) {
                list.set(channel, connections.size);
            }

            return list;
        }

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelsWithConnectionsCount',
                options: {},
            },
        });

        return this.callMethodAggregators.getChannelsWithConnectionsCount(gossipResponses);
    }

    async getChannelConnections(channel: string, forceLocal = false): Promise<Map<string, FN.Pusher.PusherWS.PusherConnection|FN.Pusher.PusherWS.PusherRemoteConnection>> {
        if (forceLocal) {
            let connections = new Map<string, FN.Pusher.PusherWS.PusherConnection>();

            if (!this.channels.has(channel)) {
                return connections;
            }

            let wsIds = this.channels.get(channel);

            for await (let connId of wsIds) {
                if (!this.connections.has(connId)) {
                    continue;
                }

                connections.set(connId, this.connections.get(connId) as FN.Pusher.PusherWS.PusherConnection);
            }

            return connections;
        }

        let options: FN.Pusher.PusherGossip.GossipDataOptions = { channel };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelConnections',
                options,
            },
        });

        return this.callMethodAggregators.getChannelConnections(gossipResponses, options);
    }

    async getChannelConnectionsCount(channel: string, forceLocal = false): Promise<number> {
        if (forceLocal) {
            return (await this.getChannelConnections(channel, true)).size;
        }

        let options: FN.Pusher.PusherGossip.GossipDataOptions = { channel };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelConnectionsCount',
                options,
            },
        });

        return this.callMethodAggregators.getChannelConnectionsCount(gossipResponses, options);
    }

    async getChannelMembers(channel: string, forceLocal = false): Promise<Map<string, FN.Pusher.PusherWS.Presence.PresenceMemberInfo>> {
        if (forceLocal) {
            let connections = await this.getChannelConnections(channel, true);
            let members = new Map<string, FN.Pusher.PusherWS.Presence.PresenceMemberInfo>();

            for await (let connection of connections) {
                let [, conn] = connection as [string, FN.Pusher.PusherWS.PusherConnection];
                let member: FN.Pusher.PusherWS.Presence.PresenceMember = conn.presence.get(channel);

                if (member) {
                    members.set(member.user_id as string, member.user_info)
                }
            }

            return members;
        }

        let options: FN.Pusher.PusherGossip.GossipDataOptions = { channel };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelMembers',
                options,
            },
        });

        return this.callMethodAggregators.getChannelMembers(gossipResponses, options);
    }

    async getChannelMembersCount(channel: string, forceLocal = false): Promise<number> {
        if (forceLocal) {
            return (await this.getChannelMembers(channel, forceLocal)).size;
        }

        let options: FN.Pusher.PusherGossip.GossipDataOptions = { channel };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelMembersCount',
                options,
            },
        });

        return this.callMethodAggregators.getChannelMembersCount(gossipResponses, options);
    }

    async send(channel: string, data: FN.Pusher.PusherWS.SentPusherMessage, exceptingId: string|null = null, forceLocal = false): Promise<void> {
        if (forceLocal) {
            let connections = await this.getChannelConnections(channel, true) as Map<string, FN.Pusher.PusherWS.PusherConnection>;

            for await (let connection of connections) {
                let [id, conn] = connection;

                if (exceptingId && exceptingId === id) {
                    continue;
                }

                conn.sendJson(data);
            }

            return;
        }

        let options: FN.Pusher.PusherGossip.GossipDataOptions = {
            channel,
            sentPusherMessage: JSON.stringify(data),
            exceptingId,
        };

        // Send for others.
        this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'send',
                options,
            },
        });

        // Also send locally.
        this.send(channel, data, exceptingId, true);
    }

    async sendMissedCacheIfExists(conn: FN.Pusher.PusherWS.PusherConnection, channel: string) {
        // TODO: Caching module
        /* let cachedEvent = await this.env.APPS.get(
            `app_${this.app.id}_channel_${channel}_cache_miss`,
        );

        if (cachedEvent) {
            conn.sendJson({ event: 'pusher:cache_miss', channel, data: cachedEvent });
        } else {
            // TODO: this.webhooks.sendCacheMissed(channel);
        } */
    }

    async getChannelManagerFor(channel: string): Promise<FN.Pusher.Channels.ChannelManager> {
        if (Utils.isPresenceChannel(channel)) {
            return new PresenceChannelManager(this, this.app);
        } else if (Utils.isEncryptedPrivateChannel(channel)) {
            return new EncryptedPrivateChannelManager(this, this.app);
        } else if (await Utils.isPrivateChannel(channel)) {
            return new PrivateChannelManager(this, this.app);
        } else {
            return new PublicChannelManager(this, this.app);
        }
    }

    get callMethodAggregators(): {
        [method: string]: (
            responses: FN.Gossip.Response[],
            options?: FN.Pusher.PusherGossip.GossipDataOptions,
        ) => any;
    } {
        return {
            getConnections: async (gossipResponses: FN.Gossip.Response[]) => {
                let localConns: Map<
                    string,
                    FN.Pusher.PusherWS.PusherConnection
                    |FN.Pusher.PusherWS.PusherRemoteConnection
                > = await this.getConnections(true);

                for await (let response of gossipResponses) {
                    let { connections } = response as FN.Pusher.PusherGossip.GossipResponse;

                    for await (let connection of connections) {
                        localConns.set(connection.id, connection);
                    }
                }

                return localConns;
            },
            isInChannel: async (gossipResponses: FN.Gossip.Response[]) => {
                for await (let response of gossipResponses) {
                    let { exists } = response as FN.Pusher.PusherGossip.GossipResponse;

                    if (exists) {
                        return true;
                    }
                }

                return false;
            },
            getConnectionsCount: async (gossipResponses: FN.Gossip.Response[]) => {
                let localConnectionsCount = await this.getConnectionsCount(true);

                for await (let response of gossipResponses) {
                    let { totalCount } = response as FN.Pusher.PusherGossip.GossipResponse;
                    localConnectionsCount += totalCount;
                }

                return localConnectionsCount;
            },
            getChannels: async (gossipResponses: FN.Gossip.Response[]) => {
                let localChannels = await this.getChannels(true);

                for await (let response of gossipResponses) {
                    let { channels } = response as FN.Pusher.PusherGossip.GossipResponse;

                    for await (let [channel, connections] of channels) {
                        // In case we also have a channel stored, just merge the local channel connections
                        // with the ones received, for the same channel.
                        if (localChannels.has(channel)) {
                            for await (let connection of connections) {
                                localChannels.set(channel, localChannels.get(channel).add(connection));
                            }
                        } else {
                            // Otherwise, create a new set in the request.
                            localChannels.set(channel, new Set(connections));
                        }
                    }
                }

                return localChannels;
            },
            getChannelsWithConnectionsCount: async (gossipResponses: FN.Gossip.Response[]) => {
                let localList = await this.getChannelsWithConnectionsCount(true);

                for await (let response of gossipResponses) {
                    let { channelsWithSocketsCount } = response as FN.Pusher.PusherGossip.GossipResponse;

                    for await (let [channel, connectionsCount] of channelsWithSocketsCount) {
                        // In case we also have a channel stored, just merge the local channel connections
                        // with the ones received, for the same channel.
                        if (localList.has(channel)) {
                            localList.set(channel, localList.get(channel) + connectionsCount);
                        } else {
                            // Otherwise, create a new set in the request.
                            localList.set(channel, connectionsCount);
                        }
                    }
                }

                return localList;
            },
            getChannelConnections: async (gossipResponses: FN.Gossip.Response[], options?: FN.Pusher.PusherGossip.GossipDataOptions) => {
                let channelSockets = await this.getChannelConnections(options.channel, true);

                for await (let response of gossipResponses) {
                    let { connections } = response as FN.Pusher.PusherGossip.GossipResponse;

                    for await (let connection of connections) {
                        channelSockets.set(connection.id, connection);
                    }
                }

                return channelSockets;
            },
            getChannelConnectionsCount: async (gossipResponses: FN.Gossip.Response[], options?: FN.Pusher.PusherGossip.GossipDataOptions) => {
                let localChannelSocketsCount = await this.getChannelConnectionsCount(options.channel, true);

                for await (let response of gossipResponses) {
                    let { totalCount } = response as FN.Pusher.PusherGossip.GossipResponse;

                    localChannelSocketsCount += totalCount;
                }

                return localChannelSocketsCount;
            },
            getChannelMembers: async (gossipResponses: FN.Gossip.Response[], options?: FN.Pusher.PusherGossip.GossipDataOptions) => {
                let localMembers = await this.getChannelMembers(options.channel, true);

                for await (let response of gossipResponses) {
                    let { members } = response as FN.Pusher.PusherGossip.GossipResponse;

                    for await (let [memberId, memberInfo] of members) {
                        localMembers.set(memberId, memberInfo);
                    }
                }

                return localMembers;
            },
            getChannelMembersCount: async (gossipResponses: FN.Gossip.Response[], options?: FN.Pusher.PusherGossip.GossipDataOptions) => {
                let localChannelMembersCount = await this.getChannelMembersCount(options.channel, true);

                for await (let response of gossipResponses) {
                    let { totalCount } = response as FN.Pusher.PusherGossip.GossipResponse;

                    localChannelMembersCount += totalCount;
                }

                return localChannelMembersCount;
            },
            send: async (gossipResponses: FN.Gossip.Response[], options?: FN.Pusher.PusherGossip.GossipDataOptions) => {
                //
            },
        };
    }

    get callMethodResponses(): { [method: string]: (options: FN.Pusher.PusherGossip.GossipDataOptions) => Promise<FN.Pusher.PusherGossip.GossipResponse> } {
        return {
            getConnections: async (options: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                connections: [...(await this.getConnections(true) as Map<string, FN.Pusher.PusherWS.PusherConnection|FN.Pusher.PusherWS.PusherRemoteConnection>).values()].map((conn) => {
                    return conn instanceof PusherConnection
                        ? conn.toRemote('pusher')
                        : conn;
                }) as FN.Pusher.PusherWS.PusherRemoteConnection[],
            }),
            isInChannel: async (options: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                exists: await this.isInChannel(options.connId, options.channel, true),
            }),
            getConnectionsCount: async (options: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                totalCount: await this.getChannelConnectionsCount(options.channel, true),
            }),
            getChannels: async (options: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                channels: [...await this.getChannels(true)].map(([channel, connections]) => [channel, [...connections]]),
            }),
            getChannelsWithConnectionsCount: async (options: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                channelsWithSocketsCount: [...await this.getChannelsWithConnectionsCount(true)],
            }),
            getChannelConnections: async ({ channel }: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                connections: [...(await this.getChannelConnections(channel, true)).values()].map((conn) => {
                    return conn instanceof PusherConnection
                        ? conn.toRemote('pusher')
                        : conn;
                }) as FN.Pusher.PusherWS.PusherRemoteConnection[],
            }),
            getChannelConnectionsCount: async ({ channel }: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                totalCount: await this.getChannelConnectionsCount(channel, true),
            }),
            getChannelMembers: async ({ channel }: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                members: [...await this.getChannelMembers(channel, true)],
            }),
            getChannelMembersCount: async ({ channel }: FN.Pusher.PusherGossip.GossipDataOptions) => ({
                totalCount: await this.getChannelMembersCount(channel, true),
            }),
            send: async ({ channel, sentPusherMessage, exceptingId }: FN.Pusher.PusherGossip.GossipDataOptions) => {
                await this.send(
                    channel,
                    JSON.parse(sentPusherMessage) as FN.Pusher.PusherWS.PusherMessage,
                    exceptingId,
                    true,
                );

                return {
                    //
                };
            },
        }
    }

    async callOthers(data: {
        topic: string;
        data: FN.Gossip.Payload;
    }): Promise<FN.Gossip.Response[]> {
        return this.gossiper.sendRequestToPeers(
            data.topic,
            await this.getPeers(),
            data.data,
        );
    }

    async getPeers(): Promise<string[]> {
        // TODO: Horizontal manager
        return [];
    }
}
