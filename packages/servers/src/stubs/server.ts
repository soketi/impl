import {
    type Brain,
    type Connections,
    type Gossiper,
} from '@soketi/impl-interfaces';

export abstract class Server<
    Cs extends Connections = Connections,
    B extends Brain = Brain,
    G extends Gossiper = Gossiper,
> {
    constructor(
        public readonly brain: B,
        public readonly gossiper: G,
        public readonly connections: Cs,
    ) {
        //
    }

    async start(signalHandler?: () => Promise<void>): Promise<void> {
        this.registerSignals(signalHandler);

        await this.brain.startup();
        await this.gossiper.startup();
    }

    async stop(options?: any): Promise<void> {
        // TODO: Let other nodes know we are draining...
        console.log('Draining connections...');
        await this.drainConnections();

        console.log('Cleaning up...');
        await this.cleanup();

        console.log('Closing server...');
        await this.closeServer();

        console.log('Done.');
    }

    async closeServer(): Promise<void> {
        //
    }

    async drainConnections(): Promise<void> {
        await this.connections.drainConnections(100e3, 'Server closed.');
    }

    async cleanup(): Promise<void> {
        await this.gossiper.cleanup();
        await this.brain.cleanup();
    }

    registerSignals(handler?: () => Promise<void>) {
        process.on('SIGINT', async () => {
            if (handler) {
                return await handler();
            }

            await this.stop();
        });

        process.on('SIGTERM', async () => {
            if (handler) {
                return await handler();
            }

            await this.stop();
        });

        process.on('uncaughtException', async error => {
            console.error(`Uncaught exception: ${error}`);

            if (handler) {
                return await handler();
            }

            await this.stop();
        });
    }
}
