export interface Brain<Value = unknown> {
    get(key: string): Promise<Value|undefined>;
    getWithMetadata(key: string): Promise<BrainRecord<Value>|undefined>;
    set(key: string, value: Value, ttlSeconds?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
    startup(): Promise<void>;
    cleanup(): Promise<void>;
};

export type BrainRecord<Value = unknown> = {
    value: Value;
    ttlSeconds: number;
    setTime: number;
};
