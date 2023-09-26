import {
    type Gossiper as GossiperInterface,
    type Connection,
    type GossipTopicHandler,
} from '@soketi/impl-interfaces';

export type ConnAnnouncementPayload<
    ConnectionID extends Connection['id'] = Connection['id'],
> = Partial<{
    connectionId: ConnectionID;
}> & Record<string, unknown>;

export abstract class Gossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload = ConnAnnouncementPayload<ConnectionID>,
> implements GossiperInterface<
    ConnectionID,
    AnnouncementPayload
> {
    announcementHandlers = new Map<
        string,
        GossipTopicHandler<AnnouncementPayload>
    >;

    abstract announce(
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void>;

    subscribeToAnnouncement(
        event: string,
        handler: (payload: AnnouncementPayload) => Promise<void>,
    ): void {
        this.announcementHandlers.set(event, {
            event,
            handler,
        });
    }

    async handleAnnouncement(
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void> {
        const handler = this.announcementHandlers.get(event);

        if (!handler) {
            return;
        }

        await handler.handler(payload);
    }

    async announceNewConnection(
        connectionId: ConnectionID,
        payload: AnnouncementPayload,
    ): Promise<void> {
        return this.announce('connection:new', {
            connectionId,
            ...payload,
        });
    }

    async announceEviction(
        connectionId: ConnectionID,
        payload: AnnouncementPayload,
    ): Promise<void> {
        return this.announce('connection:eviction', {
            connectionId,
            ...payload,
        });
    }

    async startup(): Promise<void> {
        //
    }

    async cleanup(): Promise<void> {
        //
    }
}
