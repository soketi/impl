export class Router {
    static protocols = new Map<string, { handler: Function; }>();

    static registerHandler(protocol: string, handler: Function): void {
        this.protocols.set(protocol, { handler });
    }

    static getProtocol(protocol: string): { handler: Function; } {
        return this.protocols.get(protocol);
    }

    static async handle(protocol: string, ...args): Promise<void> {
        await this.getProtocol(protocol).handler(...args);
    }
}
