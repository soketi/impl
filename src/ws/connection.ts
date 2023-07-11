import type * as FN from '@soketi/impl/types';

export class Connection implements FN.WS.Connection {
    closed = false;

    constructor(
        public id: FN.WS.ConnectionID,
        public connection: FN.WS.SoketiNativeWebsocket,
    ) {
        //
    }

    async send(message: (ArrayBuffer|ArrayBufferView)|string): Promise<void> {
        this.connection.send(message);
    }

    async sendJson(message: FN.WS.Message): Promise<void> {
        this.send(
            typeof message === 'string'
                ? message
                : JSON.stringify(message),
        );
    }

    async sendError(message: FN.WS.Message, code?: number, reason?: string): Promise<void> {
        await this.sendJson({ message, code, reason });
        this.close(code, reason);
    }

    async close(code?: number, reason?: string): Promise<void> {
        this.closed = true;
        this.connection.close(code, reason);
    }

    toRemote(remoteInstanceId?: string): FN.WS.RemoteConnection {
        return {
            id: this.id,
        };
    }
}
