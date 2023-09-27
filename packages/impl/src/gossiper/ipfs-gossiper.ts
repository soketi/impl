import { Gossiper, type DefaultPayload } from './gossiper';
import { type Libp2p } from 'libp2p';
import { type GossipsubEvents } from '@chainsafe/libp2p-gossipsub';
import { type PubSub } from '@libp2p/interface/pubsub';
import { type DualKadDHT } from '@libp2p/kad-dht';

import {
    type Announcement,
    type Connection,
} from '@soketi/impl-interfaces';

type Libp2pServices = {
    pubsub: PubSub<GossipsubEvents>;
    dht?: DualKadDHT;
};

export class IpfsGossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload extends DefaultPayload<ConnectionID> = DefaultPayload<ConnectionID>,
> extends Gossiper<ConnectionID, AnnouncementPayload> {
    constructor(protected readonly node: Libp2p<Libp2pServices>) {
        super();
    }

    async announce(
        namespace: string,
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void> {
        this.node.services.pubsub.publish(
            `${namespace}`,
            new TextEncoder().encode(JSON.stringify({ event, payload })),
        );
    }

    async subscribeToNamespace(
        namespace: string,
        handler: (data: Announcement<AnnouncementPayload>) => Promise<void>,
    ): Promise<void> {
        super.subscribeToNamespace(namespace, handler);
        this.node.services.pubsub.subscribe(`${namespace}`);
    }

    async unsubscribeFromNamespace(
        namespace: string,
    ): Promise<void> {
        super.unsubscribeFromNamespace(namespace);
        this.node.services.pubsub.unsubscribe(`${namespace}`);
    }

    async startup(): Promise<void> {
        await super.startup();

        this.node.services.pubsub.addEventListener(
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
