import * as FN from '@soketi/impl';
import { Connection as BaseConnection } from '@ws/connection';

export class Connection extends BaseConnection implements FN.Pusher.PusherWS.PusherConnection {
    subscribedChannels: Set<string>;
    presence: Map<string, FN.Pusher.PusherWS.Presence.PresenceMember>;
    timeout: any;

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

    toRemote(shard: string): FN.Pusher.PusherWS.PusherRemoteConnection {
        return {
            ...super.toRemote(shard),
            subscribedChannels: [...this.subscribedChannels],
            presence: [...this.presence].map(([channel, member]) => ({ channel, member })),
        };
    }
}
