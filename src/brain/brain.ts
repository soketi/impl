import type * as FN from '@soketi/impl/types';

export abstract class Brain {
    abstract get(key: string): Promise<FN.Brain.BrainRecord['value']|null>;
    abstract getWithMetadata(key: string): Promise<FN.Brain.BrainRecord|null>;
    abstract set(key: string, value: FN.Brain.BrainRecord['value'], ttlSeconds?: number): Promise<void>;
    abstract has(key: string): Promise<boolean>;
    abstract delete(key: string): Promise<void>;

    async cleanup(): Promise<void> {
        //
    }
}
