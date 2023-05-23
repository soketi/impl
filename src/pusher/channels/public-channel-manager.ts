import type * as FN from '@soketi/impl';

export class PublicChannelManager implements FN.Pusher.Channels.PublicChannelManager {
    constructor(protected connections: FN.Pusher.PusherWS.Connections) {
        //
    }

    async join(conn: FN.Pusher.PusherWS.PusherConnection, channel: string, message?: FN.Pusher.PusherWS.PusherMessage): Promise<FN.Pusher.Channels.JoinResponse> {
        let connections = await this.connections.addToChannel(conn, channel);

        return {
            conn,
            success: true,
            channelConnections: connections,
        };
    }

    async leave(conn: FN.Pusher.PusherWS.PusherConnection, channel: string): Promise<FN.Pusher.Channels.LeaveResponse> {
        let remainingConnections = await this.connections.removeFromChannel(conn, channel) as number;

        return {
            left: true,
            remainingConnections,
        };
    }
}
