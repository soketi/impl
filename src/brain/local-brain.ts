import type * as FN from '@soketi/impl/types';
import { Brain } from './brain';

export class LocalBrain extends Brain {
    memory: Map<string, FN.Brain.BrainRecord> = new Map();

    constructor() {
        super();

        setInterval(() => {
            for (let [key, { ttlSeconds, setTime }] of [...this.memory]) {
                let currentTime = parseInt((new Date().getTime() / 1000) as unknown as string);

                if (ttlSeconds > 0 && (setTime + ttlSeconds) <= currentTime) {
                    this.memory.delete(key);
                }
            }
        }, 1_000);
    }

    async get(key: string): Promise<FN.JSON.Value|null> {
        return (await this.getWithMetadata(key))?.value ?? null;
    }

    async getWithMetadata(key: string): Promise<FN.Brain.BrainRecord|null> {
        return this.memory.get(key) ?? null;
    }

    async set(key: string, value: FN.JSON.Value, ttlSeconds = -1): Promise<void> {
        this.memory.set(key, {
            value,
            ttlSeconds,
            setTime: parseInt((new Date().getTime() / 1000) as unknown as string),
        });
    }

    async has(key: string): Promise<boolean> {
        return Boolean(this.memory.get(key));
    }

    async delete(key: string): Promise<void> {
        this.memory.delete(key);
    }
}
