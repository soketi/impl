import { type Connection } from './ws';

export type GossipTopicHandler<Announcement>  = {
    namespace: string;
    handler?: (data: Announcement) => Promise<any>;
};

export type Announcement<AnnouncementPayload = Record<string, unknown>> = {
    event: string;
    payload?: AnnouncementPayload;
};

export interface Gossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload = Record<string, unknown>,
> {

    subscribeToNamespace(
        namespace: string,
        handler?: (data: Announcement<AnnouncementPayload>) => Promise<void>,
    ): Promise<void>;

    unsubscribeFromNamespace(
        namespace: string,
    ): Promise<void>;

    announce(
        namespace: string,
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void>;

    announceNewConnection(
        namespace: string,
        connectionId: ConnectionID,
        payload?: Partial<AnnouncementPayload>,
    ): Promise<void>;

    announceEviction(
        namespace: string,
        connectionId: ConnectionID,
        payload?: Partial<AnnouncementPayload>,
    ): Promise<void>;

    announceNewMessage(
        namespace: string,
        connectionId: ConnectionID,
        message: any,
        payload?: Partial<AnnouncementPayload>,
    ): Promise<void>;

    startup(): Promise<void>;
    cleanup(): Promise<void>;
};
