import * as FN from '@soketi/impl';

export class Connections implements FN.Pusher.PusherWS.Connections {
    async addToChannel(conn: FN.Pusher.PusherWS.PusherConnection, channel: string): Promise<number> {
        //
    }

    async removeFromChannel(conn: FN.Pusher.PusherWS.PusherConnection, channel: string|string[]): Promise<number|void> {
        //
    }
}
