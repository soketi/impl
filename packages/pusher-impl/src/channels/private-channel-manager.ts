import type { JoinResponse } from '.';
import type { PusherSubscribeToPrivate } from '../';
import type { PusherConnection } from '../ws';
import { PublicChannelManager } from './public-channel-manager';

export class PrivateChannelManager extends PublicChannelManager {
    async join(
        conn: PusherConnection,
        channel: string,
        message: PusherSubscribeToPrivate,
    ): Promise<JoinResponse> {
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
        message: PusherSubscribeToPrivate,
        signatureToCheck: string,
    ): Promise<boolean> {
        const token = await this.app.createToken(
            this.getDataToSignForSignature(socketId, message)
        );

        return this.app.key + ':' + token === signatureToCheck;
    }

    getDataToSignForSignature(socketId: string, message: PusherSubscribeToPrivate): string {
        return `${socketId}:${message.data.channel}`;
    }
}
