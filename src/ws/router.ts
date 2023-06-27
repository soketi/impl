import type * as FN from '@soketi/impl/types';
import { Router as BaseRouter } from '../router';

export class Router extends BaseRouter {
    static ON_NEW_CONNECTION = 'onNewConnection';
    static ON_CONNECTION_CLOSED = 'onConnectionClosed';
    static ON_MESSAGE = 'onMessage';
    static ON_ERROR = 'onError';

    static onNewConnection(cb: (connection: FN.WS.Connection, ...args) => any): void {
        this.registerHandler(this.ON_NEW_CONNECTION, cb);
    }

    static onConnectionClosed(cb: (connection: FN.WS.Connection, code?: number, message?: any, ...args) => any): void {
        this.registerHandler(this.ON_CONNECTION_CLOSED, cb);
    }

    static onMessage(cb: (connection: FN.WS.Connection, message: any, ...args) => any): void {
        this.registerHandler(this.ON_MESSAGE, cb);
    }

    static onError(cb: (connection: FN.WS.Connection, error: any, ...args) => any): void {
        this.registerHandler(this.ON_ERROR, cb);
    }

    static async handleNewConnection(connection: FN.WS.Connection, ...args): Promise<void> {
        await this.handle(this.ON_NEW_CONNECTION, connection, ...args);
    }

    static async handleConnectionClosed(connection: FN.WS.Connection, code?: number, message?: any, ...args): Promise<void> {
        await this.handle(this.ON_CONNECTION_CLOSED, connection, code, message, ...args);
    }

    static async handleMessage(connection: FN.WS.Connection, message: any, ...args): Promise<void> {
        await this.handle(this.ON_MESSAGE, connection, message, ...args);
    }

    static async handleError(connection: FN.WS.Connection, error: any, ...args): Promise<void> {
        await this.handle(this.ON_ERROR, connection, error, ...args);
    }
}
