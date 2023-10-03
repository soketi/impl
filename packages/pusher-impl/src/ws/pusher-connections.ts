import { Connections as BaseConnections, Connection } from '@soketi/impl/ws';
import { PusherConnection, type PusherUserID } from './';
import { PusherUtils } from '../pusher-utils';
import type { App, AppsManager } from '../apps';
import { type GossipsubEvents } from '@chainsafe/libp2p-gossipsub';
import { type IdentifyService } from 'libp2p/identify';
import { type Libp2p } from 'libp2p';
import { type Helia } from '@helia/interface';
import { type PubSub } from '@libp2p/interface/pubsub';
import { type DualKadDHT } from '@libp2p/kad-dht';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { type Peer, type PeerData } from '@libp2p/interface/peer-store';

import {
    EncryptedPrivateChannelManager,
    PrivateChannelManager,
    PublicChannelManager,
    PresenceChannelManager,
    type ChannelManager,
    // PresenceMember,
} from '../channels';

import {
    type PusherSubscriptionError,
    type AnyPusherEvent,
    type AnyPusherSubscriptionEvent,
    type PusherConnectionEstablished,
    type PusherSubscriptionSucceeded,
    type PusherClientEvent,
    type PusherError,
    type PusherSignin,
    type PusherSigninSuccess,
    // type PusherMemberAdded,
    // type PusherSubscribeToPublic,
    // type PusherMemberRemoved,
} from '../';
import type { PusherIpfsGossiper } from '../gossiper';

type Libp2pServices = {
    pubsub: PubSub<GossipsubEvents>;
    dht: DualKadDHT;
    identify: IdentifyService;
};

export class PusherConnections<
    C extends PusherConnection<Connection['id'], AnyPusherEvent> = PusherConnection<
        Connection['id'], AnyPusherEvent
    >,
    Message = AnyPusherEvent,
> extends BaseConnections<C, Message> {
    readonly channels: Map<App['id'], Map<string, Set<C['id']>>> = new Map;
    readonly users: Map<PusherUserID, Set<C['id']>> = new Map;
    readonly apps: Map<App['id'], Required<App>> = new Map;

    constructor(
        protected appsManager: AppsManager,
        protected readonly node: Helia<Libp2p<Libp2pServices>>,
    ) {
        super();
    }

    async namespaceApp(namespace: Required<App>['id']): Promise<Required<App>|undefined> {
        if (this.namespaceHasApp(namespace)) {
            return this.apps.get(namespace) as Required<App>;
        }

        const storedApp = await this.appsManager.getById(namespace as string);

        if (!storedApp) {
            return;
        }

        this.apps.set(namespace, storedApp);

        return this.apps.get(namespace) as Required<App>;
    }

    namespaceHasApp(namespace: Required<App>['id']): boolean {
        return this.apps.has(namespace);
    }

    namespaceChannel(namespace: Required<App>['id'], channel: string): Set<C['id']> {
        if (!this.namespaceHasChannel(namespace, channel)) {
            this.namespaceChannels(namespace).set(channel, new Set<C['id']>());
        }

        return this.namespaceChannels(namespace).get(channel) as Set<C['id']>;
    }

    namespaceChannels(namespace: Required<App>['id']): Map<string, Set<C['id']>> {
        if (!this.namespaceHasChannels(namespace)) {
            this.channels.set(namespace, new Map<string, Set<C['id']>>());
        }

        return this.channels.get(namespace) as Map<string, Set<C['id']>>;
    }

    namespaceHasChannels(namespace: Required<App>['id']): boolean {
        return this.channels.has(namespace);
    }

    namespaceHasChannel(namespace: Required<App>['id'], channel: string): boolean {
        return this.namespaceChannels(namespace).has(channel);
    }

    async syncCurrentPeer(data: PeerData): Promise<void> {
        await this.node.libp2p.peerStore.merge(this.node.libp2p.peerId, data);
    }

    async newConnection(conn: C): Promise<void> {
        let app = await this.namespaceApp(conn.namespace);

        if (!app) {
            return await conn.sendJsonThenClose<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'App not found.',
                },
            }, 4009, 'App not found.');
        }

        await super.newConnection(conn);

        await this.syncCurrentPeer({
            metadata: {
                [`pusher:app:${conn.namespace}:connections_count`]: uint8ArrayFromString(
                    this.namespace(conn.namespace).size.toString(),
                ),
            },
            tags: {
                [`pusher:app:${conn.namespace}:important`]: {
                    value: 1,
                },
            },
        });

        await conn.sendJson<PusherConnectionEstablished>({
            event: 'pusher:connection_established',
            data: JSON.stringify({
                socket_id: conn.id,
                activity_timeout: 30,
            }),
        });

        if (app.enableUserAuthentication) {
            conn.userAuthenticationTimeout = setTimeout(() => {
                conn.sendJson<PusherError>({
                    event: 'pusher:error',
                    data: {
                        code: 4009,
                        message: 'Connection not authorized within timeout.',
                    },
                });

                conn.close(4009, 'Connection not authorized within timeout.');
            }, app.userAuthenticationTimeout);
        }
    }

    async removeConnection(conn: C, onEmptyNamespace?: () => Promise<void>): Promise<void> {
        await conn.clearTimeout();
        await conn.clearUserAuthenticationTimeout();

        if (conn.userAuthenticationTimeout) {
            clearTimeout(conn.userAuthenticationTimeout);
        }

        await this.unsubscribeFromAllChannels(conn);

        if (conn.user) {
            if (this.users.has(conn.user.id)) {
                this.users.get(conn.user.id)?.delete(conn.id);
            }

            if (this.users.get(conn.user.id) && this.users.get(conn.user.id)?.size === 0) {
                this.users.delete(conn.user.id);
            }
        }

        await super.removeConnection(conn, async () => {
            if (onEmptyNamespace) {
                await onEmptyNamespace();
            }

            //
        });

        await this.syncCurrentPeer({
            metadata: {
                [`pusher:app:${conn.namespace}:connections_count`]: uint8ArrayFromString(
                    this.namespace(conn.namespace).size.toString(),
                ),
                [`pusher:app:${conn.namespace}:channels`]: uint8ArrayFromString(
                    JSON.stringify([...this.namespaceChannels(conn.namespace).keys()]),
                ),
                // TODO: Users?
            },
            tags: {
                [`pusher:app:${conn.namespace}:important`]: {
                    value: Number(this.namespace(conn.namespace).size > 0),
                },
            },
        });
    }

    async addToChannel(conn: C, channel: string): Promise<number> {
        conn.subscribedChannels.add(channel);
        this.namespaceChannel(conn.namespace, channel).add(conn.id);

        return await this.getChannelConnectionsCount(channel);
    }

    async removeFromChannels(conn: C, channel: string|string[]): Promise<number|void> {
        let remove = (channel: string) => {
            conn.subscribedChannels.delete(channel);
            this.namespaceChannel(conn.namespace, channel).delete(conn.id);
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

    async subscribeToChannel(conn: C, message: AnyPusherSubscriptionEvent): Promise<any> {
        const app = await this.namespaceApp(conn.namespace);

        if (!app) {
            conn.sendJson<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'App not found.',
                },
            });

            return conn.close(4009, 'App not found.');
        }

        let channel = message.data.channel;
        let channelManager = await this.getChannelManagerFor(channel, app);
        let maxChannelNameLength = app.maxChannelNameLength;

        if (channel.length > maxChannelNameLength) {
            return conn.sendJson<PusherSubscriptionError>({
                event: 'pusher:subscription_error',
                channel,
                data: {
                    type: 'LimitReached',
                    error: `The channel name is longer than the allowed ${maxChannelNameLength} characters.`,
                    status: 4009,
                },
            });
        }

        let response = await channelManager.join(conn, channel, message as any);

        if (!response.success) {
            let { authError, type, errorMessage, errorCode } = response;

            // For auth errors, send pusher:subscription_error
            if (authError) {
                return conn.sendJson<PusherSubscriptionError>({
                    event: 'pusher:subscription_error',
                    channel,
                    data: {
                        type: 'AuthError',
                        error: errorMessage as string,
                        status: 401,
                    },
                });
            }

            // Otherwise, catch any non-auth related errors.
            return conn.sendJson<PusherSubscriptionError>({
                event: 'pusher:subscription_error',
                channel,
                data: {
                    type: type as string,
                    error: errorMessage as string,
                    status: errorCode as number,
                },
            });
        }

        // If the connection freshly joined, send the webhook:
        if (response.channelConnections === 1) {
            // TODO: this.webhooks.sendChannelOccupied(channel);
        }

        // For non-presence channels, end with subscription succeeded.
        if (!(channelManager instanceof PresenceChannelManager)) {
            conn.sendJson<PusherSubscriptionSucceeded>({
                event: 'pusher_internal:subscription_succeeded',
                channel,
                data: '{}',
            });

            await this.syncCurrentPeer({
                metadata: {
                    [`pusher:app:${conn.namespace}:channels`]: uint8ArrayFromString(
                        JSON.stringify([...this.namespaceChannels(conn.namespace).keys()]),
                    ),
                    [`pusher:app:${conn.namespace}:channel:${channel}:connections_count`]: uint8ArrayFromString(
                        this.namespaceChannel(conn.namespace, channel).size.toString(),
                    ),
                },
                tags: {
                    [`pusher:app:${conn.namespace}:channel:${channel}:important`]: {
                        value: 1,
                    },
                },
            });

            // if (await PusherUtils.isCachingChannel(channel)) {
            //     this.sendMissedCacheIfExists(conn, channel);
            // }

            return;
        }

        // Otherwise, prepare a response for the presence channel.
        // conn.presence.set(channel, response.member as PresenceMember);

        // TODO: Presence
        // If the member already exists in the channel, don't resend the member_added event.
        /* if (!members.has(String(response.member?.user_id))) {
            await this.broadcastToChannel<PusherMemberAdded>(channel, {
                event: 'pusher_internal:member_added',
                channel,
                data: JSON.stringify({
                    user_id: response.member?.user_id,
                    user_info: response.member?.user_info,
                }),
            }, conn.id);

            members.set(String(response.member?.user_id), user_info);

            // TODO: this.webhooks.sendMemberAdded(channel, member.user_id as string);
        }

        await conn.sendJson<PusherSubscriptionSucceeded>({
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

        if (await PusherUtils.isCachingChannel(channel)) {
            this.sendMissedCacheIfExists(conn, channel);
        } */
    }

    async unsubscribeFromAllChannels(conn: C): Promise<void> {
        await Promise.allSettled(
            [...conn.subscribedChannels].map(channel => this.unsubscribeFromChannel(conn, channel))
        );
    }

    async unsubscribeFromChannel(conn: C, channel: string): Promise<void> {
        const app = await this.namespaceApp(conn.namespace);

        if (!app) {
            conn.sendJson<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'App not found.',
                },
            });

            return conn.close(4009, 'App not found.');
        }

        let channelManager = await this.getChannelManagerFor(channel, app);
        let response = await channelManager.leave(conn, channel);

        if (response.left) {
            // Send presence channel-speific events and delete specific data.
            // This can happen only if the user is connected to the presence channel.
            // TODO: Presence
            /* let member = conn.presence.get(channel);
                if (channelManager instanceof PresenceChannelManager && conn.presence.has(channel)) {
                conn.presence.delete(channel);

                let members = await this.getChannelMembers(channel);

                if (!members.has(member.user_id as string)) {
                    await this.broadcastToChannel(channel, {
                        event: 'pusher_internal:member_removed',
                        channel,
                        data: JSON.stringify({ user_id: member.user_id }),
                    }, conn.id);

                    // TODO: this.webhooks.sendMemberRemoved(channel, member.user_id as string);
                }
            } */

            conn.subscribedChannels.delete(channel);

            if (response.remainingConnections === 0) {
                // TODO: this.webhooks.sendChannelVacated(channel);
            }
        }

        await this.removeFromChannels(conn, channel);

        await this.syncCurrentPeer({
            metadata: {
                [`pusher:app:${conn.namespace}:channels`]: uint8ArrayFromString(
                    JSON.stringify([...this.namespaceChannels(conn.namespace)]),
                ),
                [`pusher:app:${conn.namespace}:channel:${channel}:connections_count`]: uint8ArrayFromString(
                    this.namespaceChannel(conn.namespace, channel).size.toString(),
                ),
            },
            tags: {
                [`pusher:app:${conn.namespace}:channel:${channel}:important`]: {
                    value: Number(this.namespaceChannels(conn.namespace).size > 0),
                },
            },
        });
    }

    async handleClientEvent(
        conn: C,
        message: PusherClientEvent,
        announceChannelBroadcast: (...args: Parameters<PusherIpfsGossiper['announceChannelBroadcast']>) => ReturnType<PusherIpfsGossiper['announceChannelBroadcast']>,
    ): Promise<any> {
        const app = await this.namespaceApp(conn.namespace);

        if (!app) {
            conn.sendJson<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'App not found.',
                },
            });

            return conn.close(4009, 'App not found.');
        }

        let { event, data, channel } = message;

        if (!app.enableClientMessages) {
            return conn.sendJson<PusherError>({
                event: 'pusher:error',
                channel,
                data: {
                    code: 4301,
                    message: `The app does not have client messaging enabled.`,
                },
            });
        }

        // Make sure the event name length is not too big.
        let maxEventnameLength = app.maxEventNameLength;

        if (event.length > maxEventnameLength) {
            return conn.sendJson<PusherError>({
                event: 'pusher:error',
                channel,
                data: {
                    code: 4301,
                    message: `Event name is too long. Maximum allowed size is ${maxEventnameLength}.`,
                },
            });
        }

        let payloadSizeInKb = await PusherUtils.dataToKilobytes(message.data);
        let maxPayloadSizeInKb = app.maxEventPayloadInKb;

        // Make sure the total payload of the message body is not too big.
        if (payloadSizeInKb > maxPayloadSizeInKb) {
            return conn.sendJson<PusherError>({
                event: 'pusher:error',
                channel,
                data: {
                    code: 4301,
                    message: `The event data should be less than ${maxPayloadSizeInKb} KB.`,
                },
            });
        }

        let canBroadcast = await this.isInLocalChannel(conn, channel);

        if (!canBroadcast) {
            return;
        }

        // TODO: Rate limiting
        // let userId = conn.presence.has(channel) ? conn.presence.get(channel).user_id as string : null;

        let eventMessage = {
            event,
            channel,
            data,
            // ...userId ? { user_id: userId } : {},
        };

        // Broadcast locally.
        this.broadcastJsonMessageToChannel<PusherClientEvent>(
            app.id,
            eventMessage,
            [conn.id],
        );

        // Announce via Pubsub
        announceChannelBroadcast(
            eventMessage,
            app.key,
            app.id,
            conn.id,
        );

        // TODO:
        // this.webhooks.sendClientEvent(
        //     channel, event, data, conn.id, userId
        // );
    }

    async handleSignin(
        conn: C,
        message: PusherSignin,
    ): Promise<void> {
        if (!conn.userAuthenticationTimeout) {
            return;
        }

        const app = await this.namespaceApp(conn.namespace);

        if (!app) {
            conn.sendJson<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'App not found.',
                },
            });

            return conn.close(4009, 'App not found.');
        }

        const tokenIsValid = await app.signinTokenIsValid(
            conn.id,
            message.data.user_data,
            message.data.auth,
        );

        if (!tokenIsValid) {
            conn.sendJson<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'Connection not authorized.',
                },
            });

            return conn.close(4009, 'Connection not authorized.');
        }

        const decodedUser = JSON.parse(message.data.user_data);

        if (!decodedUser.id) {
            conn.sendJson<PusherError>({
                event: 'pusher:error',
                data: {
                    code: 4009,
                    message: 'The returned user data must contain the "id" field.',
                },
            });

            return conn.close(4009, 'The returned user data must contain the "id" field.');
        }

        conn.user = {
            ...decodedUser,
            ...{
                id: decodedUser.id.toString(),
            },
        };

        if (conn.userAuthenticationTimeout) {
            clearTimeout(conn.userAuthenticationTimeout);
        }

        if (conn.user) {
            if (!this.users.has(conn.user.id)) {
                this.users.set(conn.user.id, new Set());
            }

            if (!this.users.get(conn.user.id)?.has(conn.id)) {
                this.users.get(conn.user.id)?.add(conn.id);
            }
        }

        conn.sendJson<PusherSigninSuccess>({
            event: 'pusher:signin_success',
            data: message.data,
        });
    }

    async broadcastJsonMessageToChannel<T extends PusherClientEvent>(
        namespace: string,
        message: T,
        exclude?: C['id'][],
    ): Promise<void> {
        const connections = this.getLocalChannelConnections(namespace, message.channel);

        for await (const conn of connections) {
            if (exclude && exclude.includes(conn.id)) {
                continue;
            }

            conn.sendJson<T>(message as T);
        }
    }

    async isInLocalChannel(conn: C, channel: string): Promise<boolean> {
        if (!this.channels.has(channel)) {
            return false;
        }

        return this.namespaceChannel(conn.namespace, channel).has(conn.id);
    }

    async getConnectionsCount(namespace: string): Promise<number> {
        const peers = await this.node.libp2p.peerStore.all({
            filters: [
                peer => peer.tags.get(`pusher:app:${namespace}:important`)?.value === 1,
            ],
        });

        const value = (peer: Peer) => peer.metadata.get(`pusher:app:${namespace}:connections_count`)
            || uint8ArrayFromString('0');

        return peers.reduce((total, peer) => {
            return total + Number(uint8ArrayToString(value(peer)));
        }, 0);
    }

    getLocalChannelConnections(namespace: string, channel: string): Set<C> {
        const cids = this.namespaceChannel(namespace, channel);

        return new Set(
            [...cids].map(id => this.namespace(namespace)?.get(id))
                .filter(c => c !== undefined) as C[]
        );
    }

    async getChannelsWithConnectionsCount(namespace: string): Promise<Map<string, number>> {
        const peers = await this.node.libp2p.peerStore.all({
            filters: [
                peer => peer.tags.has(`app:${namespace}`),
            ],
        });

        const value = (peer: Peer) => peer.metadata.get(`pusher:app:${namespace}:channels`)
            || uint8ArrayFromString('[]');

        const channels = peers.reduce((channels, peer) => {
            return channels.concat(JSON.parse(uint8ArrayToString(value(peer))));
        }, [] as string[]);

        const channelsWithConnections = new Map<string, number>();

        for await (let channel of channels) {
            channelsWithConnections.set(channel, await this.getChannelConnectionsCount(channel));
        }

        return channelsWithConnections;
    }

    async getChannelConnectionsCount(namespace: string): Promise<number> {
        const peers = await this.node.libp2p.peerStore.all({
            filters: [
                peer => peer.tags.has(`app:${namespace}`),
            ],
        });

        const value = (peer: Peer) => peer.metadata.get(
            `pusher:app:${namespace}:channel:${namespace}:connections_count`
        ) || uint8ArrayFromString('0');

        return peers.reduce((total, peer) => {
            return total + Number(uint8ArrayToString(value(peer)));
        }, 0);
    }

    /* async getChannelMembers(namespace: string, forceLocal = false): Promise<Map<string, PusherPresence.PresenceMemberInfo>> {
        if (forceLocal) {
            let connections = await this.getChannelConnections(channel, true);
            let members = new Map<string, PusherPresence.PresenceMemberInfo>();

            for await (let connection of connections) {
                let [, conn] = connection as [string, PusherConnection];
                let member: PusherPresence.PresenceMember = conn.presence.get(channel);

                if (member) {
                    members.set(member.user_id as string, member.user_info)
                }
            }

            return members;
        }

        let options: PusherGossip.GossipDataOptions = { channel };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelMembers',
                options,
            },
        });

        return this.callMethodAggregators.getChannelMembers(gossipResponses, options);
    } */

    /* async getChannelMembersCount(channel: string, forceLocal = false): Promise<number> {
        if (forceLocal) {
            return (await this.getChannelMembers(channel, forceLocal)).size;
        }

        let options: PusherGossip.GossipDataOptions = { channel };

        let gossipResponses = await this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'getChannelMembersCount',
                options,
            },
        });

        return this.callMethodAggregators.getChannelMembersCount(gossipResponses, options);
    } */

    /* async terminateUserConnections(userId: PusherUserID, forceLocal = false): Promise<void> {
        if (forceLocal) {
            const connectionIds = this.users.get(userId.toString()) || new Set<string>();

            for await (let connId of [...connectionIds]) {
                this.connections.get(connId)?.close(4009, 'You got disconnected by the app.');
            }

            return;
        }

        let options: PusherGossip.GossipDataOptions = {
            appId: this.app.id,
            userId: userId.toString(),
        };

        this.callOthers({
            topic: 'callMethod',
            data: {
                methodToCall: 'terminateUserConnections',
                options,
            },
        });

        // Also terminate locally.
        this.terminateUserConnections(userId.toString(), true);
    } */

    /* async sendMissedCacheIfExists(conn: C, channel: string) {
        let cachedEvent = await this.brain.get(
            `app_${this.app.id}_channel_${channel}_cache_miss`,
        );

        if (cachedEvent) {
            conn.sendJson({
                event: 'pusher:cache_miss',
                channel,
                data: cachedEvent,
            });
        } else {
            // TODO: Send webhook event.
        }
    } */

    async getChannelManagerFor(channel: string, app: Required<App>): Promise<ChannelManager> {
        if (await PusherUtils.isPresenceChannel(channel)) {
            return new PresenceChannelManager(this, app);
        } else if (await PusherUtils.isEncryptedPrivateChannel(channel)) {
            return new EncryptedPrivateChannelManager(this, app);
        } else if (await PusherUtils.isPrivateChannel(channel)) {
            return new PrivateChannelManager(this, app);
        } else {
            return new PublicChannelManager(this, app);
        }
    }

    /* get callMethodAggregators(): {
        [method: string]: (
            responses: Gossip.Response[],
            options?: PusherGossip.GossipDataOptions,
        ) => any;
    } {
        return {
            getConnections: async (gossipResponses: Gossip.Response[]) => {
                let localConns: Map<
                    string,
                    PusherConnection
                    |PusherRemoteConnection
                > = await this.getConnections(true);

                for await (let response of gossipResponses) {
                    let { connections } = response as PusherGossip.GossipResponse;

                    for await (let connection of connections) {
                        localConns.set(connection.id, connection);
                    }
                }

                return localConns;
            },
            isInChannel: async (gossipResponses: Gossip.Response[]) => {
                for await (let response of gossipResponses) {
                    let { exists } = response as PusherGossip.GossipResponse;

                    if (exists) {
                        return true;
                    }
                }

                return false;
            },
            getConnectionsCount: async (gossipResponses: Gossip.Response[]) => {
                let localConnectionsCount = await this.getConnectionsCount(true);

                for await (let response of gossipResponses) {
                    let { totalCount } = response as PusherGossip.GossipResponse;
                    localConnectionsCount += totalCount;
                }

                return localConnectionsCount;
            },
            getChannels: async (gossipResponses: Gossip.Response[]) => {
                let localChannels = await this.getChannels(true);

                for await (let response of gossipResponses) {
                    let { channels } = response as PusherGossip.GossipResponse;

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
            getChannelsWithConnectionsCount: async (gossipResponses: Gossip.Response[]) => {
                let localList = await this.getChannelsWithConnectionsCount(true);

                for await (let response of gossipResponses) {
                    let { channelsWithSocketsCount } = response as PusherGossip.GossipResponse;

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
            getChannelConnections: async (gossipResponses: Gossip.Response[], options?: PusherGossip.GossipDataOptions) => {
                let channelSockets = await this.getChannelConnections(options.channel, true);

                for await (let response of gossipResponses) {
                    let { connections } = response as PusherGossip.GossipResponse;

                    for await (let connection of connections) {
                        channelSockets.set(connection.id, connection);
                    }
                }

                return channelSockets;
            },
            getChannelConnectionsCount: async (gossipResponses: Gossip.Response[], options?: PusherGossip.GossipDataOptions) => {
                let localChannelSocketsCount = await this.getChannelConnectionsCount(options.channel, true);

                for await (let response of gossipResponses) {
                    let { totalCount } = response as PusherGossip.GossipResponse;

                    localChannelSocketsCount += totalCount;
                }

                return localChannelSocketsCount;
            },
            getChannelMembers: async (gossipResponses: Gossip.Response[], options?: PusherGossip.GossipDataOptions) => {
                let localMembers = await this.getChannelMembers(options.channel, true);

                for await (let response of gossipResponses) {
                    let { members } = response as PusherGossip.GossipResponse;

                    for await (let [memberId, memberInfo] of members) {
                        localMembers.set(memberId, memberInfo);
                    }
                }

                return localMembers;
            },
            getChannelMembersCount: async (gossipResponses: Gossip.Response[], options?: PusherGossip.GossipDataOptions) => {
                let localChannelMembersCount = await this.getChannelMembersCount(options.channel, true);

                for await (let response of gossipResponses) {
                    let { totalCount } = response as PusherGossip.GossipResponse;

                    localChannelMembersCount += totalCount;
                }

                return localChannelMembersCount;
            },
            terminateUserConnections: async (gossipResponses: Gossip.Response[], options?: PusherGossip.GossipDataOptions) => {
                //
            },
            send: async (gossipResponses: Gossip.Response[], options?: PusherGossip.GossipDataOptions) => {
                //
            },
        };
    }

    get callMethodResponses(): { [method: string]: (options: PusherGossip.GossipDataOptions) => Promise<PusherGossip.GossipResponse> } {
        return {
            getConnections: async (options: PusherGossip.GossipDataOptions) => ({
                connections: [...(await this.getConnections(true) as Map<string, PusherConnection|PusherRemoteConnection>).values()].map((conn) => {
                    return conn instanceof PusherConnection
                        ? conn.toRemote('pusher')
                        : conn;
                }) as PusherRemoteConnection[],
            }),
            isInChannel: async (options: PusherGossip.GossipDataOptions) => ({
                exists: await this.isInChannel(options.connId, options.channel, true),
            }),
            getConnectionsCount: async (options: PusherGossip.GossipDataOptions) => ({
                totalCount: await this.getChannelConnectionsCount(options.channel, true),
            }),
            getChannels: async (options: PusherGossip.GossipDataOptions) => ({
                channels: [...await this.getChannels(true)].map(([channel, connections]) => [channel, [...connections]]),
            }),
            getChannelsWithConnectionsCount: async (options: PusherGossip.GossipDataOptions) => ({
                channelsWithSocketsCount: [...await this.getChannelsWithConnectionsCount(true)],
            }),
            getChannelConnections: async ({ channel }: PusherGossip.GossipDataOptions) => ({
                connections: [...(await this.getChannelConnections(channel, true)).values()].map((conn) => {
                    return conn instanceof PusherConnection
                        ? conn.toRemote('pusher')
                        : conn;
                }) as PusherRemoteConnection[],
            }),
            getChannelConnectionsCount: async ({ channel }: PusherGossip.GossipDataOptions) => ({
                totalCount: await this.getChannelConnectionsCount(channel, true),
            }),
            getChannelMembers: async ({ channel }: PusherGossip.GossipDataOptions) => ({
                members: [...await this.getChannelMembers(channel, true)],
            }),
            getChannelMembersCount: async ({ channel }: PusherGossip.GossipDataOptions) => ({
                totalCount: await this.getChannelMembersCount(channel, true),
            }),
            terminateUserConnections: async ({ userId, appId }: PusherGossip.GossipDataOptions) => {
                if (appId !== this.app.id) {
                    return;
                }

                await this.terminateUserConnections(userId, true);

                return {
                    //
                };
            },
            send: async ({ channel, sentMessage, exceptingId }: PusherGossip.GossipDataOptions) => {
                await this.broadcastToChannel(
                    channel,
                    JSON.parse(sentMessage) as PusherMessage,
                    exceptingId,
                    true,
                );

                return {
                    //
                };
            },
        }
    } */

    /* async callOthers(data: {
        topic: string;
        data: Gossip.Payload;
    }): Promise<Gossip.Response[]> {
        return this.gossiper.sendRequestToPeers(
            data.topic,
            data.data,
        );
    } */
}
