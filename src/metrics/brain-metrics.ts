import type * as FN from '@soketi/impl/types';
import { Brain } from '../brain';
import { Metrics } from './metrics';
import { Connections } from '../ws';

export class BrainMetrics extends Metrics {
    metrics: FN.JSON.Object = {};

    constructor(
        readonly brain: Brain,
        readonly connections: Connections,
    ) {
        super(connections);
    }

    async snapshot(namespace: string): Promise<void> {
        this.snapshotInProgress = true;

        await this.brain.set(`metrics:${namespace}`, {
            connections: this.connections.connections.size,
        });

        this.snapshotInProgress = false;
    }

    async get(namespace: string): Promise<FN.JSON.Object> {
        return (await this.brain.get(`metrics:${namespace}`)) || {};
    }

    async cleanup(): Promise<void> {
        //
    }
}
