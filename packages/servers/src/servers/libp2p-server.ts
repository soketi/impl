import { LocalBrain } from '@soketi/impl/brain';
import { IpfsGossiper } from '@soketi/impl/gossiper';
import { Connections } from '@soketi/impl/ws';
// import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { mdns } from '@libp2p/mdns';
import { noise }  from '@chainsafe/libp2p-noise';
import { tcp } from '@libp2p/tcp';
import { kadDHT } from '@libp2p/kad-dht';
import { MicroWebsocketServer } from '../stubs';
import { createLibp2p } from 'libp2p';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayTransport } from 'libp2p/circuit-relay';
// import { circuitRelayServer } from 'libp2p/circuit-relay';
import { identifyService } from 'libp2p/identify';
// import { generateKey, preSharedKey } from 'libp2p/pnet';
// import { autoNATService } from 'libp2p/autonat';
import { prometheusMetrics } from '@libp2p/prometheus-metrics';
import { createHelia } from 'helia';
import { type GossipsubEvents } from '@chainsafe/libp2p-gossipsub';
import { type PubSub } from '@libp2p/interface/pubsub';
import { type IdentifyService } from 'libp2p/identify';
import { type DualKadDHT } from '@libp2p/kad-dht';

type Libp2pServices = {
    pubsub: PubSub<GossipsubEvents>;
    dht: DualKadDHT;
    identify: IdentifyService;
};

;(async () => {
    const libp2p = await createLibp2p<Libp2pServices>({
        transports: [
            tcp({
                inboundSocketInactivityTimeout: 3_600 * 24, // 1 day
                outboundSocketInactivityTimeout: 3_600 * 24, // 1 day
                socketCloseTimeout: 3 * 60_000, // 3 minutes
                maxConnections: 200,
            }),
            webSockets({
                //
            }),
            circuitRelayTransport({
                discoverRelays: 1,
            }),
        ],
        addresses: {
            listen: process.env.SOKETI_P2P_ADDRESSES?.split(',') || [
                '/ip4/0.0.0.0/tcp/0',
                '/ip4/0.0.0.0/tcp/0/ws',
            ],
        },
        streamMuxers: [
            // yamux(),
            mplex(),
        ],
        connectionEncryption: [
            noise(),
        ],
        peerDiscovery: [
            mdns({
                interval: 1 * 60_000, // 1 minute
            }),
        ],
        services: {
            identify: identifyService(),
            pubsub: gossipsub({
                heartbeatInterval: 500,
                messageProcessingConcurrency: 100,
                canRelayMessage: true,
                maxInboundStreams: 100,
                maxOutboundStreams: 100,
                allowPublishToZeroPeers: true,
                ignoreDuplicatePublishError: true,
                emitSelf: false,
                asyncValidation: false,
                Dhi: 6,
                Dlo: 1,
                D: 3,
                seenTTL: 3e3,
                doPX: true,
                scoreParams: {
                    behaviourPenaltyWeight: 0,
                    retainScore: 1,
                }
            }),
            dht: kadDHT({
                allowQueryWithZeroPeers: true,
                querySelfInterval: 10_000,
                pingConcurrency: 10,
            }),
        },
        start: false,
        metrics: prometheusMetrics({
            collectDefaultMetrics: true,
        }),
        // connectionProtector: preSharedKey({
        //     psk: (() => {
        //         const swarmKey = new Uint8Array(95);
        //         generateKey(swarmKey);
        //         return swarmKey;
        //     })(),
        // }),
        connectionManager: {
            maxConnections: 100,
            minConnections: 1,
            autoDialConcurrency: 1,
        },
        transportManager: {
            faultTolerance: 0,
        },
    });

    const helia = await createHelia({
        libp2p,
        start: false,
    });

    const connections = new Connections();
    const brain = new LocalBrain();
    const gossiper = new IpfsGossiper(helia);

    const server = new MicroWebsocketServer(
        brain,
        gossiper,
        connections,
    );

    helia.libp2p.addEventListener('start', async () => {
        // After libp2p starts, we need to start the server.
        await server.start(async () => helia.stop());
    });

    helia.libp2p.addEventListener('stop', async () => {
        // Before stopping libp2p, we need to stop the server.
        await server.stop();
        await helia.stop();
    });

    // The server will start after libp2p starts.
    helia.start();
})();
