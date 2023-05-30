import type * as FN from '@soketi/impl/types';
import { Connection as BaseConnection } from '../../ws';

export class PusherConnection extends BaseConnection implements FN.Pusher.PusherWS.PusherConnection {
    subscribedChannels: Set<string>;
    presence: Map<string, FN.Pusher.PusherWS.Presence.PresenceMember>;
    timeout: any;

    constructor(
        public id: FN.WS.ConnectionID|null,
        public connection: FN.WS.SoketiNativeWebsocket,
    ) {
        super(id, connection);

        this.id = id || this.generateSocketId();
        this.subscribedChannels = new Set();
        this.presence = new Map();
    }

    protected generateSocketId(): string {
        let min = 0;
        let max = 10_000_000_000;
        let randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

        return `${randomNumber(min, max)}.${randomNumber(min, max)}`;
    }

    async handlePong(): Promise<void> {
        this.sendJson({
            event: 'pusher:pong',
            data: {},
        });
    }

    async clearTimeout(): Promise<void> {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }

    async updateTimeout(): Promise<void> {
        this.clearTimeout();
        this.timeout = setTimeout(() => this.close(), 120_000);
    }

    async sendJson(message: FN.WS.Message): Promise<void> {
        try {
            if (!this.closed) {
                super.sendJson(message);
            }

            this.updateTimeout();
        } catch (e) {
            //
        }
    }

    async close(code?: number, reason?: string): Promise<void> {
        this.closed = true;

        setTimeout(() => {
            try {
                super.close(code, reason);
            } catch (e) {
                //
            }
        }, 500);
    }

    toRemote(remoteInstanceId?: string): FN.Pusher.PusherWS.PusherRemoteConnection {
        return {
            ...super.toRemote(remoteInstanceId),
            subscribedChannels: [...this.subscribedChannels],
            presence: [...this.presence].map(([channel, member]) => ({ channel, member })),
        };
    }
}
