import { IpfsGossiper as BaseGossiper } from '@soketi/impl/gossiper';
import type { PusherConnection } from '../ws';
import type { AnyPusherEvent } from '..';

export type PusherPayload<
    ConnectionID extends PusherConnection['id'] = PusherConnection['id'],
    T = Record<string, unknown>,
> = {
    exceptingId?: ConnectionID;
    connectionId?: ConnectionID;
    channel?: string;
    appKey?: string;
    appId?: string;
    message?: AnyPusherEvent;
} & T;

export class PusherIpfsGossiper<
    ConnectionID extends PusherConnection['id'] = PusherConnection['id'],
    AnnouncementPayload extends PusherPayload<ConnectionID> = PusherPayload<ConnectionID>,
> extends BaseGossiper<ConnectionID, AnnouncementPayload> {
    async announceChannelSubscription(
        connectionId: ConnectionID,
        channel: string,
        appKey: string,
        appId: string,
    ) {
        return this.announce(appId, 'pusher:channel:subscribe', {
            connectionId,
            channel,
            appKey,
            appId,
        } as AnnouncementPayload);
    }

    async announceChannelUnsubscription(
        connectionId: ConnectionID,
        channel: string,
        appKey: string,
        appId: string,
    ) {
        return this.announce(appId, 'pusher:channel:unsubscribe', {
            connectionId,
            channel,
            appKey,
            appId,
        } as AnnouncementPayload);
    }

    async announceAppSubscription(
        appKey: string,
        appId: string,
    ) {
        return this.announce(appId, 'pusher:app:new', {
            appKey,
            appId,
        } as AnnouncementPayload);
    }

    async announceAppUnsubscription(
        appKey: string,
        appId: string,
    ) {
        return this.announce(appId, 'pusher:app:forget', {
            appKey,
            appId,
        } as AnnouncementPayload);
    }

    async announceChannelBroadcast<T = AnyPusherEvent>(
        message: T,
        appKey: string,
        appId: string,
        exceptingId?: ConnectionID,
    ) {
        return this.announce(appId, 'pusher:channel:broadcast', {
            exceptingId,
            message,
            appId,
            appKey,
        } as AnnouncementPayload);
    }
}
