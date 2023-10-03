import type { JoinResponse, LeaveResponse } from './';
import type { PusherSubscribeToPublic } from '../';
import type { App } from '../apps';
import type { PusherConnection, PusherConnections } from '../ws';

export class PublicChannelManager {
    constructor(
        protected readonly connections: PusherConnections,
        protected readonly app: Required<App>,
    ) {
        //
    }

    async join(conn: PusherConnection, channel: string, message?: PusherSubscribeToPublic): Promise<JoinResponse> {
        let connections = await this.connections.addToChannel(conn, channel);

        return {
            conn,
            success: true,
            channelConnections: connections,
        };
    }

    async leave(conn: PusherConnection, channel: string): Promise<LeaveResponse> {
        let remainingConnections = await this.connections.removeFromChannels(conn, channel) as number;

        return {
            left: true,
            remainingConnections,
        };
    }
}
