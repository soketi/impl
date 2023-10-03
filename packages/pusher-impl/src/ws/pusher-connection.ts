import { Connection } from '@soketi/impl/ws';
import { type RemoteConnection } from '@soketi/impl-interfaces';
import { type PusherUser } from './pusher-user';
import { PusherUtils } from '../pusher-utils';
import type { PresenceMember } from '../channels';
import type { AnyPusherEvent } from '../';

import {
    type NativeConnectionHandlers,
    type NativeWebsocket,
} from '@soketi/impl-interfaces';

export class PusherConnection<
    ID extends Connection['id'] = Connection['id'],
    Message = AnyPusherEvent,
> extends Connection<ID, Message> {
    readonly subscribedChannels: Set<string> = new Set();
    readonly presence: Map<string, PresenceMember<ID>> = new Map();

    userAuthenticationTimeout?: NodeJS.Timeout;
    user!: PusherUser<string>;

    constructor(
        public id: ID,
        public namespace: string,
        public connection: NativeWebsocket,
        public handlers: NativeConnectionHandlers<Message>,
    ) {
        super(
            id,
            namespace,
            connection,
            handlers,
        );

        this.id = id || this.generateSocketId();
    }

    async clearUserAuthenticationTimeout(): Promise<void> {
        if (this.userAuthenticationTimeout) {
            clearTimeout(this.userAuthenticationTimeout);
        }
    }

    async close(code?: number, reason?: string): Promise<void> {
        this.clearUserAuthenticationTimeout();
        super.close(code, reason);
    }

    protected generateSocketId(): ID {
        return PusherUtils.generateSocketId() as ID;
    }

    async handlePong(): Promise<void> {
        this.sendJson({
            event: 'pusher:pong',
            data: {},
        } as Message);
    }

    toRemote(remoteInstanceId?: ID): PusherRemoteConnection<ID> {
        return {
            ...super.toRemote(remoteInstanceId),
            user: this.user,
            subscribedChannels: [...this.subscribedChannels],
            presence: [...this.presence].map(([channel, member]) => ({ channel, member: member.toObject() })),
        };
    }
}

export type PusherRemoteConnection<
    ID extends Connection['id'] = Connection['id'],
> = {
    subscribedChannels: string[];
    user: PusherUser<string>;
    presence: {
        channel: string;
        member: ReturnType<PresenceMember['toObject']>;
    }[];
} & RemoteConnection<ID>;
