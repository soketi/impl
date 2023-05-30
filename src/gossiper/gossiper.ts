import type * as FN from '@soketi/impl/types';

export abstract class Gossiper {
    protocols = new Map<string, { responseResolver: FN.Gossip.ResponseHandler; }>();

    constructor(data: {
        protocol: string;
        responseResolver: FN.Gossip.ResponseHandler;
    }[] = []) {
        for (const protocol of data) {
            this.registerProtocol(protocol);
        }
    }

    registerProtocol(data: {
        protocol: string;
        responseResolver: FN.Gossip.ResponseHandler;
    }): void {
        if (!this.protocols.has(data.protocol)) {
            this.protocols.set(data.protocol, {
                responseResolver: data.responseResolver.bind(this),
            });
        }
    }

    async resolveResponse(protocol: string, msg: FN.JSON.Object): Promise<FN.Gossip.Response> {
        const handler = this.protocols.get(protocol);

        if (handler) {
            return handler.responseResolver(msg);
        }

        throw new Error(`Unknown protocol: ${protocol}`);
    }

    abstract sendRequestToPeers(
        protocol: string,
        peers: string[],
        message: FN.Gossip.Payload,
    ): Promise<FN.Gossip.Response[]>;
}
