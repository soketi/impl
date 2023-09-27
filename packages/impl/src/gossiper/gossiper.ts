import {
    type Gossiper as GossiperInterface,
    type Connection,
    type GossipTopicHandler,
    type Announcement,
} from '@soketi/impl-interfaces';

export type DefaultPayload<
    ConnectionID extends Connection['id'] = Connection['id'],
    T = Record<string, unknown>,
> = {
    connectionId?: ConnectionID;
    message?: any;
} & T;

export abstract class Gossiper<
    ConnectionID extends Connection['id'] = Connection['id'],
    AnnouncementPayload extends DefaultPayload<ConnectionID> = DefaultPayload<ConnectionID>,
> implements GossiperInterface<ConnectionID, AnnouncementPayload> {
    announcementHandlers = new Map<
        string,
        GossipTopicHandler<Announcement<AnnouncementPayload>>
    >;

    abstract announce(
        namespace: string,
        event: string,
        payload: AnnouncementPayload,
    ): Promise<void>;

    async handleAnnouncement(
        namespace: string,
        data: Announcement<AnnouncementPayload>,
    ): Promise<void> {
        const handler = this.announcementHandlers.get(namespace);

        if (!handler || !handler.handler) {
            return;
        }

        await handler.handler(data);
    }

    async subscribeToNamespace(
        namespace: string,
        handler?: (data: Announcement<AnnouncementPayload>) => Promise<void>,
    ): Promise<void> {
        this.announcementHandlers.set(`${namespace}`, {
            namespace,
            handler,
        });
    }

    async unsubscribeFromNamespace(
        namespace: string,
    ): Promise<void> {
        this.announcementHandlers.delete(`${namespace}`);
    }

    async announceNewConnection(
        namespace: string,
        connectionId: ConnectionID,
        payload?: Partial<AnnouncementPayload>,
    ): Promise<void> {
        this.announce(namespace, 'connection:new', {
            connectionId,
            ...((payload || {}) as AnnouncementPayload),
        });
    }

    async announceEviction(
        namespace: string,
        connectionId: ConnectionID,
        payload?: Partial<AnnouncementPayload>,
    ): Promise<void> {
        this.announce(namespace, 'connection:eviction', {
            connectionId,
            ...((payload || {}) as AnnouncementPayload),
        });
    }

    announceNewMessage(
        namespace: string,
        connectionId: ConnectionID,
        message: any,
        payload?: Partial<AnnouncementPayload>,
    ): Promise<void> {
        return this.announce(namespace, 'message:incoming', {
            connectionId,
            message,
            ...((payload || {}) as AnnouncementPayload),
        });
    }

    async startup(): Promise<void> {
        //
    }

    async cleanup(): Promise<void> {
        //
    }
}
