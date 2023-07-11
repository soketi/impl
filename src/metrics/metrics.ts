import type * as FN from '@soketi/impl/types';
import { Connections } from '../ws';

export abstract class Metrics {
    snapshotInProgress = false;

    constructor(
        readonly connections: Connections,
    ) {
        //
    }

    abstract snapshot(namespace: string): Promise<void>;
    abstract get(namespace: string): Promise<FN.JSON.Object>;

    async cleanup(): Promise<void> {
        //
    }
}
