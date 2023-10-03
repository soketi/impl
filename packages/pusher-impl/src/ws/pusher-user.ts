export type PusherUserID = string;

export type PusherUserT<
    UID extends PusherUserID = PusherUserID,
> = {
    id: UID;
    [key: string]: any;
};

export class PusherUser<
    UID extends PusherUserID = PusherUserID,
> implements PusherUserT<UID> {
    public id!: UID;

    // TODO: Impl
    static fromPresenceMember() {
        //
    }

    static fromLiteral(data: string) {
        //
    }
}
