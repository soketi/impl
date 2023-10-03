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
        public namespace: string,
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

    async send<M = Message>(message: M): Promise<void> {
        await this.handlers.send<M>(message);
        this.updateTimeout();
    }

    async sendJson<M>(message: M): Promise<void> {
        try {
            // We actually just "try" to make it JSON.
            // If it fails, we just send the message as-is.
            const m = JSON.stringify(message);
            this.send<M>(m as M);
        } catch (e) {
            this.send<M>(message);
        }
    }

    async sendError<M>(message: M, code?: number, reason?: string): Promise<void> {
        await this.send<M>(message);
        this.close(code, reason);
    }

    async close(code?: number, reason?: string): Promise<void> {
        this.closed = true;

        this.clearTimeout();

        setTimeout(async () => {
            await this.handlers.close(code, reason);
        }, 100);
    }

    async sendThenClose<M>(message: M, code?: number, reason?: string): Promise<void> {
        await this.send<M>(message);
        this.close(code, reason);
    }

    async sendJsonThenClose<M>(message: M, code?: number, reason?: string): Promise<void> {
        await this.sendJson<M>(message);
        this.close(code, reason);
    }

    async sendErrorThenClose<M>(message: M, code?: number, reason?: string): Promise<void> {
        await this.sendError<M>(message, code, reason);
        this.close(code, reason);
    }

    toRemote(remoteInstanceId?: ID): RemoteConnection<ID> {
        return {
            id: this.id,
            namespace: this.namespace,
        };
    }
}
