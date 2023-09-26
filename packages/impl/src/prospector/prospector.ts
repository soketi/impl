import {
    type ProspectingRoute,
    type Prospector as ProspectorInterface,
} from '@soketi/impl-interfaces';

export abstract class Prospector<
    Payload = unknown,
    PeerResponse = unknown,
> implements ProspectorInterface<Payload, PeerResponse> {
    routes = new Map<
        string,
        ProspectingRoute<Payload, PeerResponse>
    >();

    abstract sendRequestToPeersVia(
        route: string,
        payload: Payload,
    ): Promise<PeerResponse[]>;

    async respondToRoute(
        route: string,
        payload: Payload,
    ): Promise<PeerResponse> {
        const handler = this.routes.get(route);

        if (!handler) {
            throw new Error(`Route ${route} not found.`);
        }

        return handler.onRequest(payload);
    }

    registerRoute({ route, onRequest }: ProspectingRoute<Payload, PeerResponse>): void {
        this.routes.set(route, {
            route,
            onRequest,
        });
    }

    async startup(): Promise<void> {
        //
    }

    async cleanup(): Promise<void> {
        //
    }
}
