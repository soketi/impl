import {
    type Brain as BrainInterface,
    type BrainRecord,
} from '@soketi/impl-interfaces';

export abstract class Brain<Value = unknown> implements BrainInterface<Value> {
    abstract get(key: string): Promise<Value|undefined>;
    abstract getWithMetadata(key: string): Promise<BrainRecord<Value>|undefined>;
    abstract set(key: string, value: Value, ttlSeconds?: number): Promise<void>;
    abstract has(key: string): Promise<boolean>;
    abstract delete(key: string): Promise<void>;
    abstract startup(): Promise<void>;

    async cleanup(): Promise<void> {
        //
    }
}
