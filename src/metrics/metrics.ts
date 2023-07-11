import type * as FN from '@soketi/impl/types';
import * as dot from 'dot-wild';
import { Connections } from '../ws';

export abstract class Metrics {
    snapshotInProgress = false;
    metrics: FN.JSON.Object = {};

    constructor(
        readonly connections: Connections,
    ) {
        //
    }

    abstract snapshot(namespace: string): Promise<void>;
    abstract get(namespace: string): Promise<FN.JSON.Object>;
    abstract increment(namespace: string, key: string, value?: number): Promise<void>;
    abstract decrement(namespace: string, key: string, value?: number, min?: number): Promise<void>;
    abstract set(namespace: string, key: string, value: number): Promise<void>;

    async cleanup(): Promise<void> {
        //
    }

    async waitForSnapshot(): Promise<void> {
        while (this.snapshotInProgress) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    async initiateMetric(namespace: string, key: string): Promise<string> {
        const bucketPath = this.bucketPath(namespace, key).join('.');

        if (!dot.has(this.metrics, bucketPath)) {
            this.metrics = dot.set(this.metrics, bucketPath, 0);
        }

        return bucketPath;
    }

    bucketPath(namespace: string, key: string): string[] {
        return [
            namespace,
            key,
            `d:${(new Date).getUTCDate().toString()}`,
            `h:${(new Date).getUTCHours().toString()}`,
        ];
    }
}
