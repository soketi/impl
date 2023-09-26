export type ProspectingRouteHandler<
    Payload = unknown,
    PeerResponse = unknown,
> = (payload: Payload) => Promise<PeerResponse>;

export type ProspectingRoute<
    Payload = unknown,
    PeerResponse = unknown,
> = {
    route: string;
    onRequest: ProspectingRouteHandler<Payload, PeerResponse>;
};

export interface Prospector<
    Payload = unknown,
    PeerResponse = unknown,
> {
    routes: Map<
        string,
        ProspectingRoute<Payload, PeerResponse>
    >;

    sendRequestToPeersVia(
        route: string,
        payload: Payload,
    ): Promise<PeerResponse[]>;

    registerRoute(route: ProspectingRoute<Payload, PeerResponse>): void;

    respondToRoute(
        route: string,
        payload: Payload,
    ): Promise<PeerResponse>;

    startup(): Promise<void>;
    cleanup(): Promise<void>;
}
