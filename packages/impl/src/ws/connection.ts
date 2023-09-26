import {
    type Connection as ConnectionInterface,
    type NativeConnectionHandlers,
    type RemoteConnection,
    type JsonStringifiable,
    type NativeWebsocket,
} from '@soketi/impl-interfaces';

export class Connection<
    ID extends ConnectionInterface['id'] = ConnectionInterface['id'],
    Message = JsonStringifiable,
    NativeConnection = NativeWebsocket,
> implements ConnectionInterface<ID, Message, NativeConnection> {
    closed = false;
    timeout!: NodeJS.Timeout;

    constructor(
        public id: ID,
        public connection: NativeConnection,
        public handlers: NativeConnectionHandlers<Message>,
    ) {
        //
    }

    async clearTimeout(): Promise<void> {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }

    async updateTimeout(): Promise<void> {
        this.clearTimeout();
        this.timeout = setTimeout(() => this.close(), 120_000);
    }

    async send(message: Message): Promise<void> {
        await this.handlers.send(message);
        this.updateTimeout();
    }

    async sendJson(message: Message): Promise<void> {
        try {
            // We actually just "try" to make it JSON.
            // If it fails, we just send the message as-is.
            const m = JSON.stringify(message);
            this.send(m as Message);
        } catch (e) {
            //
        }

        this.send(message);
    }

    async sendError(message: Message, code?: number, reason?: string): Promise<void> {
        await this.send(message);
        this.close(code, reason);
    }

    async close(code?: number, reason?: string): Promise<void> {
        this.closed = true;

        setTimeout(async () => {
            await this.handlers.close(code, reason);
        }, 100);
    }

    toRemote(remoteInstanceId?: ID): RemoteConnection<ID> {
        return {
            id: this.id,
        };
    }
}
