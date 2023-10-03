import type { PusherConnection } from '../ws';
import type { EncryptedPrivateChannelManager } from './encrypted-private-channel-manager';
import type { PresenceMember } from './presence';
import type { PresenceChannelManager } from './presence-channel-manager';
import type { PrivateChannelManager } from './private-channel-manager';
import type { PublicChannelManager } from './public-channel-manager';

export type LeaveResponse = {
    left: boolean;
    remainingConnections?: number;
    member?: PresenceMember;
}

export type JoinResponse = {
    conn: PusherConnection;
    success: boolean;
    channelConnections?: number;
    authError?: boolean;
    member?: PresenceMember;
    errorMessage?: string;
    errorCode?: number;
    type?: string;
}

export type ChannelManager = PublicChannelManager
    |PrivateChannelManager
    |EncryptedPrivateChannelManager
    |PresenceChannelManager;

export * from './encrypted-private-channel-manager';
export * from './presence-channel-manager';
export * from './private-channel-manager';
export * from './public-channel-manager';
export * from './presence';
