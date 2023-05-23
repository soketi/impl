export class Router {
    static protocols = new Map<string, { handler: Function; }>();

    static ON_NEW_CONNECTION = 'onNewConnection';
    static ON_CONNECTION_CLOSED = 'onConnectionClosed';
    static ON_MESSAGE = 'onMessage';
    static ON_ERROR = 'onError';

    static registerHandler(protocol: string, handler: Function): void {
        this.protocols.set(protocol, { handler });
    }

    static onNewConnection(cb: (connection: any) => any): void {
        this.registerHandler(this.ON_NEW_CONNECTION, cb);
    }

    static onConnectionClosed(cb: (connection: any) => any): void {
        this.registerHandler(this.ON_CONNECTION_CLOSED, cb);
    }

    static onMessage(cb: (connection: any, message: any) => any): void {
        this.registerHandler(this.ON_MESSAGE, cb);
    }

    static onError(cb: (connection: any, error: any) => any): void {
        this.registerHandler(this.ON_ERROR, cb);
    }

    static async handleNewConnection(connection: any): Promise<void> {
        await this.getProtocol(this.ON_NEW_CONNECTION).handler(connection);
    }

    static async handleConnectionClosed(connection: any): Promise<void> {
        await this.getProtocol(this.ON_CONNECTION_CLOSED).handler(connection);
    }

    static async handleMessage(connection: any, message: any): Promise<void> {
        await this.getProtocol(this.ON_MESSAGE).handler(connection, message);
    }

    static async handleError(connection: any, error: any): Promise<void> {
        await this.getProtocol(this.ON_ERROR).handler(connection, error);
    }

    static getProtocol(protocol: string): { handler: Function; } {
        return this.protocols.get(protocol);
    }
}
