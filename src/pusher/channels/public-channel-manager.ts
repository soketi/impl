import type * as FN from '@soketi/impl/types';

export class PublicChannelManager implements FN.Pusher.Channels.PublicChannelManager {
    constructor(
        protected readonly connections: FN.Pusher.PusherWS.PusherConnections,
        protected readonly app: FN.Pusher.PusherApps.App,
    ) {
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
        let remainingConnections = await this.connections.removeFromChannels(conn, channel) as number;

        return {
            left: true,
            remainingConnections,
        };
    }
}
