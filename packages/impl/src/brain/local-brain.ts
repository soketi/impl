import { Brain } from './brain';
import type { BrainRecord } from '@soketi/impl-interfaces';

export class LocalBrain<Value = unknown> extends Brain<Value> {
    memory: Map<string, BrainRecord<Value>> = new Map();
    cleanupInterval: NodeJS.Timeout;

    constructor() {
        super();

        this.cleanupInterval = setInterval(() => {
            for (let [key, { ttlSeconds, setTime }] of [...this.memory]) {
                let currentTime = parseInt((new Date().getTime() / 1000) as unknown as string);

                if (ttlSeconds > 0 && (setTime + ttlSeconds) <= currentTime) {
                    this.memory.delete(key);
                }
            }
        }, 1_000);
    }

    async get(key: string): Promise<Value|undefined> {
        return (await this.getWithMetadata(key))?.value;
    }

    async getWithMetadata(key: string): Promise<BrainRecord<Value>|undefined> {
        return this.memory.get(key);
    }

    async set(key: string, value: any, ttlSeconds = -1): Promise<void> {
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

    async startup(): Promise<void> {
        this.memory.clear();
    }

    async cleanup(): Promise<void> {
        this.memory.clear();
        clearInterval(this.cleanupInterval);
    }
}
