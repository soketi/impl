import type * as FN from '@soketi/impl/types';

export class Router {
    static protocols = new Map<string, { handler: Function; }>();

    static ON_NEW_CONNECTION = 'onNewConnection';
    static ON_CONNECTION_CLOSED = 'onConnectionClosed';
    static ON_MESSAGE = 'onMessage';
    static ON_ERROR = 'onError';

    static registerHandler(protocol: string, handler: Function): void {
        this.protocols.set(protocol, { handler });
    }

    static onNewConnection(cb: (connection: FN.WS.Connection) => any): void {
        this.registerHandler(this.ON_NEW_CONNECTION, cb);
    }

    static onConnectionClosed(cb: (connection: FN.WS.Connection, code?: number, message?: any) => any): void {
        this.registerHandler(this.ON_CONNECTION_CLOSED, cb);
    }

    static onMessage(cb: (connection: FN.WS.Connection, message: any) => any): void {
        this.registerHandler(this.ON_MESSAGE, cb);
    }

    static onError(cb: (connection: FN.WS.Connection, error: any) => any): void {
        this.registerHandler(this.ON_ERROR, cb);
    }

    static async handleNewConnection(connection: FN.WS.Connection): Promise<void> {
        await this.getProtocol(this.ON_NEW_CONNECTION).handler(connection);
    }

    static async handleConnectionClosed(connection: FN.WS.Connection, code?: number, message?: any): Promise<void> {
        await this.getProtocol(this.ON_CONNECTION_CLOSED).handler(connection, code, message);
    }

    static async handleMessage(connection: FN.WS.Connection, message: any): Promise<void> {
        await this.getProtocol(this.ON_MESSAGE).handler(connection, message);
    }

    static async handleError(connection: FN.WS.Connection, error: any): Promise<void> {
        await this.getProtocol(this.ON_ERROR).handler(connection, error);
    }

    static getProtocol(protocol: string): { handler: Function; } {
        return this.protocols.get(protocol);
    }
}
