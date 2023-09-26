import {
    type Brain,
    type Connections,
    type Gossiper,
    type Prospector
} from '@soketi/impl-interfaces';

export abstract class Server<
    Cs extends Connections = Connections,
    B extends Brain = Brain,
    G extends Gossiper = Gossiper,
    P extends Prospector = Prospector,
> {
    constructor(
        public readonly brain: B,
        public readonly gossiper: G,
        public readonly prospector: P,
        public readonly connections: Cs,
    ) {
        //
    }

    async start(signalHandler?: () => Promise<void>): Promise<void> {
        this.registerSignals(signalHandler);

        await this.prospector.startup();
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
        await this.prospector.cleanup();
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
