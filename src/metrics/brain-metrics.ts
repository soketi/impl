import type * as FN from '@soketi/impl/types';
import * as dot from 'dot-wild';
import { Brain } from '../brain';
import { Metrics } from './metrics';
import { Connections } from '../ws';

export class BrainMetrics extends Metrics {
    constructor(
        readonly brain: Brain,
        readonly connections: Connections,
    ) {
        super(connections);
    }

    async increment(namespace: string, key: string, value = 1): Promise<void> {
        await this.waitForSnapshot();
        const path = await this.initiateMetric(namespace, key);

        this.metrics = dot.set(
            this.metrics,
            path,
            dot.get(this.metrics, path, 0) + value,
        );
    }

    async decrement(namespace: string, key: string, value = 1, min = 0): Promise<void> {
        await this.waitForSnapshot();
        const path = await this.initiateMetric(namespace, key);

        this.metrics = dot.set(
            this.metrics,
            path,
            Math.max(dot.get(this.metrics, path, 0) - value, min),
        );
    }

    async set(namespace: string, key: string, value: number): Promise<void> {
        await this.waitForSnapshot();
        const path = await this.initiateMetric(namespace, key);

        this.metrics = dot.set(
            this.metrics,
            path,
            value,
        );
    }

    async snapshot(namespace: string): Promise<void> {
        this.snapshotInProgress = true;

        await this.brain.set(`metrics:${namespace}`, {
            total_connections: this.connections.connections.size,
            ...this.metrics[namespace] || {},
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
