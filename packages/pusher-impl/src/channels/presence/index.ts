export * from './presence-member';

export type PresenceMemberStaticData = {
    user_id: number|string;
    user_info: Record<string, unknown>;
    socket_id?: string;
}
