import { Gossiper, type ConnAnnouncementPayload } from './gossiper';
import { type Libp2p } from 'libp2p';
import { type GossipsubEvents } from '@chainsafe/libp2p-gossipsub';
import { type PubSub } from '@libp2p/interface/pubsub';
import { type DualKadDHT } from '@libp2p/kad-dht';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

import {
    type Connection,
} from '@soketi/impl-interfaces';

type Libp2pServices = Required<{
    pubsub: PubSub<GossipsubEvents>;
    dht: DualKadDHT;
}>;

export class IpfsGossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload = ConnAnnouncementPayload<ConnectionID>,
> extends Gossiper<
    ConnectionID,
    AnnouncementPayload
> {
    constructor(protected readonly node: Libp2p<Libp2pServices>) {
        super();
    }

    async announce(
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void> {
        this.node.services.pubsub.publish(
            'soketi:v1:libp2p',
            uint8ArrayFromString(JSON.stringify({ event, payload })),
        );
    }

    async startup(): Promise<void> {
        this.node.services.pubsub.addEventListener(
            'message',
            async evt => {
                console.log(`received: ${uint8ArrayToString(evt.detail.data)} on topic ${evt.detail.topic}`)
                console.dir(evt, {depth: 100});

                await this.handleAnnouncement(
                    evt.detail.topic,
                    JSON.parse(uint8ArrayToString(evt.detail.data)),
                );
            },
        );

        this.node.services.pubsub.subscribe('soketi:v1:libp2p');
    }
}
