import type * as FN from '@soketi/impl/types';
import { PrivateChannelManager } from './private-channel-manager';
import { Utils } from '../';

export class PresenceChannelManager extends PrivateChannelManager implements FN.Pusher.Channels.PresenceChannelManager {
    async join(
        conn: FN.Pusher.PusherWS.PusherConnection,
        channel: string,
        message?: FN.Pusher.PusherWS.PusherMessage,
    ): Promise<FN.Pusher.Channels.JoinResponse> {
        let membersCount = await this.connections.getChannelMembersCount(channel);

        if (membersCount + 1 > this.app.maxPresenceMembersPerChannel) {
            return {
                success: false,
                conn,
                errorCode: 4004,
                errorMessage: 'The maximum members per presence channel limit was reached',
                type: 'LimitReached',
            };
        }

        let member: FN.Pusher.PusherWS.Presence.PresenceMember = JSON.parse(message.data.channel_data);
        let memberSizeInKb = await Utils.dataToKilobytes(member.user_info);
        let maxMemberSizeInKb = this.app.maxPresenceMemberSizeInKb;

        if (memberSizeInKb > maxMemberSizeInKb) {
            return {
                success: false,
                conn,
                errorCode: 4301,
                errorMessage: `The maximum size for a channel member is ${maxMemberSizeInKb} KB.`,
                type: 'LimitReached',
            };
        }

        let response = await super.join(conn, channel, message);

        if (!response.success) {
            return response;
        }

        return {
            ...response,
            ...{ member },
        };
    }

    async leave(
        conn: FN.Pusher.PusherWS.PusherConnection,
        channel: string,
    ): Promise<FN.Pusher.Channels.LeaveResponse> {
        let response = await super.leave(conn, channel);

        return {
            ...response,
            ...{
                member: conn.presence.get(channel),
            },
        };
    }

    getDataToSignForSignature(socketId: string, message: FN.Pusher.PusherWS.PusherMessage): string {
        return `${socketId}:${message.data.channel}:${message.data.channel_data}`;
    }
}
