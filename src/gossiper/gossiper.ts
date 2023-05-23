import type * as FN from '@soketi/impl';

export abstract class Gossiper {
    static protocols = new Map();

    static registerProtocol(
        protocol: string,
        responseHandler: Function,
        metadata?: FN.JSON.Object,
    ) {
        this.protocols.set(protocol, {
            responseHandler,
            metadata,
        });
    }

    abstract sendRequestToPeers(protocol: string, peers: string[], metadata?: FN.JSON.Object): Promise<any[]>;
}
