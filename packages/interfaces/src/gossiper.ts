import { type Connection } from './ws';

export type GossipTopicHandler<AnnouncementPayload>  = {
    event: string;
    handler: (payload: AnnouncementPayload) => Promise<any>;
};

export interface Gossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload = Partial<Record<string, unknown>>,
> {
    announce(
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void>;

    announceNewConnection(
        connectionId: ConnectionID,
        payload: AnnouncementPayload,
    ): Promise<void>;

    announceEviction(
        connectionId: ConnectionID,
        payload: AnnouncementPayload,
    ): Promise<void>;

    startup(): Promise<void>;
    cleanup(): Promise<void>;
};
