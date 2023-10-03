import { PrivateChannelManager } from './private-channel-manager';
// import { PusherUtils } from '../pusher-utils';
import type { PusherConnection } from '../ws';
import type { PusherSubscribeToPresence } from '../';
import { /* PresenceMember, */ type JoinResponse, type LeaveResponse, /* type PresenceMemberStaticData */ } from '.';

export class PresenceChannelManager extends PrivateChannelManager {
    async join(
        conn: PusherConnection,
        channel: string,
        message: PusherSubscribeToPresence,
    ): Promise<JoinResponse> {
        return {
            success: false,
            conn,
            errorCode: 4301,
            errorMessage: `The maximum size for a channel member is 150 KB.`,
            type: 'LimitReached',
        };
        /* let membersCount = await this.connections.getChannelMembersCount(channel);

        if (membersCount + 1 > this.app.maxPresenceMembersPerChannel) {
            return {
                success: false,
                conn,
                errorCode: 4004,
                errorMessage: 'The maximum members per presence channel limit was reached',
                type: 'LimitReached',
            };
        }

        let member: PresenceMemberStaticData = JSON.parse(message.data.channel_data);
        let memberSizeInKb = await PusherUtils.dataToKilobytes(member.user_info);
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
            ...{ member: PresenceMember.fromObject(member) },
        }; */
    }

    async leave(
        conn: PusherConnection,
        channel: string,
    ): Promise<LeaveResponse> {
        let response = await super.leave(conn, channel);

        return {
            ...response,
            ...{
                member: conn.presence.get(channel),
            },
        };
    }

    getDataToSignForSignature(socketId: string, message: PusherSubscribeToPresence): string {
        return `${socketId}:${message.data.channel}:${message.data.channel_data}`;
    }
}
