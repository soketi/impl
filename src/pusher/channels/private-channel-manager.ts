import type * as FN from '@soketi/impl/types';
import { PublicChannelManager } from './public-channel-manager';

export class PrivateChannelManager extends PublicChannelManager implements FN.Pusher.Channels.PrivateChannelManager {
    async join(
        conn: FN.Pusher.PusherWS.PusherConnection,
        channel: string,
        message?: FN.Pusher.PusherWS.PusherMessage,
    ): Promise<FN.Pusher.Channels.JoinResponse> {
        let passedSignature = message?.data?.auth;
        let signatureIsValid = await this.signatureIsValid(conn.id, message, passedSignature);

        if (!signatureIsValid) {
            return {
                conn,
                success: false,
                errorCode: 4009,
                errorMessage: 'The connection is unauthorized.',
                authError: true,
                type: 'AuthError',
            };
        }

        return await super.join(conn, channel, message);
    }

    async signatureIsValid(
        socketId: string,
        message: FN.Pusher.PusherWS.PusherMessage,
        signatureToCheck: string,
    ): Promise<boolean> {
        const token = await this.app.createToken(
            this.getDataToSignForSignature(socketId, message)
        );

        return this.app.key + ':' + token === signatureToCheck;
    }

    getDataToSignForSignature(socketId: string, message: FN.Pusher.PusherWS.PusherMessage): string {
        return `${socketId}:${message.data.channel}`;
    }
}
