import { type GossipsubEvents } from '@chainsafe/libp2p-gossipsub';
import { type PubSub } from '@libp2p/interface/pubsub';
import { type Libp2p } from 'libp2p';
import { type DualKadDHT } from '@libp2p/kad-dht';
import { Prospector } from './prospector';
import { type ProspectingRoute } from '@soketi/impl-interfaces';
// import { pipe } from 'it-pipe';
// import all from 'it-all';
// import { CID } from 'multiformats';
// import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
// import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

type Libp2pServices = {
    pubsub: PubSub<GossipsubEvents>;
    dht: DualKadDHT;
};

export class IpfsProspector<
    Payload = unknown,
    PeerResponse = unknown,
> extends Prospector<Payload, PeerResponse> {
    constructor(protected readonly node: Libp2p<Libp2pServices>) {
        super();
    }

    async sendRequestToPeersVia(
        route: string,
        payload: Payload,
    ): Promise<PeerResponse[]> {
        return new Promise(async resolve => {
            /* // this.node.contentRouting.findProviders(
            //     //
            // );

            const peers = await this.getPeers();

            Promise.allSettled(
                peers.map(peer => this.node?.dialProtocol(peer, route)),
            );

            const stream = await this.node.dialProtocol(peers[0], protocol); */

            resolve([]);
        });
    }

    registerRoute(route: ProspectingRoute<Payload, PeerResponse>): void {
        super.registerRoute(route);

        // Make sure to also register the p2p protocol.
        this.registerP2pProtocol(route);
    }

    async registerP2pProtocol({
        route,
        onRequest,
    }: ProspectingRoute<Payload, PeerResponse>): Promise<void> {
        this.node.register(route, {
            onConnect: (peerId, conn) => {
                console.log('onConnect', peerId, conn);
            },
            onDisconnect: (peerId) => {
                console.log('onDisconnect', peerId);
            },
        });

        /* this.node.handle(route, async ({ stream }) => {
            const payload = await pipe(
                stream,
                async function* (source) {
                    for await (const message of source) {
                        yield message;
                    }
                },
                async function (source) {
                    for await (const message of source) {
                        return message;
                    }
                },
            );

            if (!payload) {
                return;
            }

            await pipe([
                await onRequest(
                    JSON.parse(uint8ArrayToString(payload)),
                )
            ], stream);
        }); */
    }

    async startup(): Promise<void> {
        //
    }

    async cleanup(): Promise<void> {
        //
    }
}
