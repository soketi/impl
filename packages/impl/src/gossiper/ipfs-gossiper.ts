import { type GossipsubEvents } from '@chainsafe/libp2p-gossipsub';
import { Gossiper, type DefaultPayload } from './gossiper';
import { type IdentifyService } from 'libp2p/identify';
import { type Libp2p } from 'libp2p';
import { type Helia } from '@helia/interface';
import { type PubSub } from '@libp2p/interface/pubsub';
import { type DualKadDHT } from '@libp2p/kad-dht';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { type Peer } from '@libp2p/interface/peer-store';

import {
    type Announcement,
    type Connection,
} from '@soketi/impl-interfaces';

type Libp2pServices = {
    pubsub: PubSub<GossipsubEvents>;
    dht: DualKadDHT;
    identify: IdentifyService;
};

export class IpfsGossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload extends DefaultPayload<ConnectionID> = DefaultPayload<ConnectionID>,
> extends Gossiper<ConnectionID, AnnouncementPayload> {
    constructor(protected readonly node: Helia<Libp2p<Libp2pServices>>) {
        super();
    }

    async peers(): Promise<Record<string, any>> {
        const peerToObject = (peer: Peer) => ({
            id: peer.id.toString(),
            addrs: peer.addresses.map(addr => addr.multiaddr),
            metadata: [...peer.metadata].map(([key, value]) => ({
                key,
                value: uint8ArrayToString(value),
            })),
            protocols: peer.protocols,
            tags: [...peer.tags].map(([key, value]) => ({
                key,
                value: value.value,
            })),
        });

        return {
            me: this.node.libp2p.peerId.toString(),
            peerStore: (await this.node.libp2p.peerStore.all()).map(peer => peerToObject(peer)),
            connections: this.node.libp2p.getConnections().map(conn => ({
                id: conn.id,
                remotePeer: conn.remotePeer.toString(),
                remoteAddr: conn.remoteAddr.toString(),
                status: conn.status,
                tags: conn.tags,
                transient: conn.transient,
                timeline: conn.timeline,
                multiplexer: conn.multiplexer,
                encryption: conn.encryption,
                direction: conn.direction,
                streams: conn.streams.map(stream => ({
                    id: stream.id,
                    direction: stream.direction,
                    timeline: stream.timeline,
                    protocol: stream.protocol,
                    metadata: stream.metadata,
                    status: stream.status,
                    readStatus: stream.readStatus,
                    writeStatus: stream.writeStatus,
                })),
            })),
            pubsub: {
                peers: this.node.libp2p.services.pubsub.getPeers(),
                topics: this.node.libp2p.services.pubsub.getTopics(),
            },
        };
    }

    async announce(
        namespace: string,
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void> {
        this.node.libp2p.services.pubsub.publish(
            `${namespace}`,
            new TextEncoder().encode(JSON.stringify({ event, payload })),
        );
    }

    async subscribeToNamespace(
        namespace: string,
        handler: (data: Announcement<AnnouncementPayload>) => Promise<void>,
    ): Promise<void> {
        super.subscribeToNamespace(namespace, handler);
        this.node.libp2p.services.pubsub.subscribe(`${namespace}`);
    }

    async unsubscribeFromNamespace(
        namespace: string,
    ): Promise<void> {
        super.unsubscribeFromNamespace(namespace);
        this.node.libp2p.services.pubsub.unsubscribe(`${namespace}`);
    }

    async startup(): Promise<void> {
        await super.startup();

        this.node.libp2p.services.pubsub.addEventListener(
            'message',
            async evt => {
                console.log(`received: ${new TextDecoder().decode(evt.detail.data)} on ns ${evt.detail.topic}`);

                await this.handleAnnouncement(
                    evt.detail.topic,
                    JSON.parse(new TextDecoder().decode(evt.detail.data)),
                );
            },
        );
    }
}
