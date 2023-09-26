import { LocalBrain } from '@soketi/impl/brain';
import { IpfsGossiper } from '@soketi/impl/gossiper';
import { IpfsProspector } from '@soketi/impl/prospector';
import { Connections } from '@soketi/impl/ws';
import { mplex } from '@libp2p/mplex';
import { mdns } from '@libp2p/mdns';
import { noise }  from '@chainsafe/libp2p-noise';
import { tcp } from '@libp2p/tcp';
import { kadDHT } from '@libp2p/kad-dht';
import { MicroWebsocketServer } from '../stubs';
import { createLibp2p } from 'libp2p';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';

(async () => {
    const libp2p = await createLibp2p({
        transports: [
            tcp({
                inboundSocketInactivityTimeout: 200,
                outboundSocketInactivityTimeout: 200,
                maxConnections: 5_000,
            }),
        ],
        addresses: {
            listen: ['/ip4/0.0.0.0/tcp/0'],
        },
        streamMuxers: [
            mplex(),
        ],
        connectionEncryption: [
            noise(),
        ],
        peerDiscovery: [
            mdns({
                serviceTag: 'soketiv1',
                interval: 500,
                broadcast: true,
            }),
        ],
        services: {
            pubsub: gossipsub({
                heartbeatInterval: 500,
                messageProcessingConcurrency: 100,
                canRelayMessage: true,
                maxInboundStreams: 100,
                maxOutboundStreams: 100,
                allowPublishToZeroPeers: true,
                ignoreDuplicatePublishError: true,
                asyncValidation: false,
                Dhi: 10,
                Dlo: 3,
                D: 6,
                seenTTL: 5e3,
            }),
            dht: kadDHT({
                allowQueryWithZeroPeers: true,
            }),
        },
        start: false,
        connectionManager: {
            maxConnections: 5_000,
        },
        transportManager: {
            faultTolerance: 0,
        },
    });

    const connections = new Connections();
    const brain = new LocalBrain();
    const gossiper = new IpfsGossiper(libp2p);
    const prospector = new IpfsProspector(libp2p);

    const server = new MicroWebsocketServer(
        brain,
        gossiper,
        prospector,
        connections,
    );

    libp2p.addEventListener('start', async () => {
        // After libp2p starts, we need to start the server.
        await server.start(async () => libp2p.stop());
    });

    libp2p.addEventListener('stop', async () => {
        // Before stopping libp2p, we need to stop the server.
        await server.stop();
        await libp2p.stop();
    });

    // The server will start after libp2p starts.
    libp2p.start();
})();
