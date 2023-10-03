import type { JsonObject } from '@soketi/impl-interfaces';
import crypto from 'crypto';

export type PusherEnvironment = {
    [key: string]: any;
};

export class PusherUtils {
    protected static clientEventPatterns: string[] = [
        'client-*',
    ];

    protected static privateChannelPatterns: string[] = [
        'private-*',
        'private-encrypted-*',
        'presence-*',
    ];

    protected static cachingChannelPatterns: string[] = [
        'cache-*',
        'private-cache-*',
        'private-encrypted-cache-*',
        'presence-cache-*',
    ];

    static async matchesPattern(pattern: string, string: string): Promise<boolean> {
        return new RegExp(pattern.replace('*', '.*')).test(string);
    }

    static async dataToBytes(...data: any): Promise<number> {
        let totalBytes = 0;

        for await (let element of data) {
            element = typeof element === 'string' ? element : JSON.stringify(element);

            try {
                totalBytes += new TextEncoder().encode(element).byteLength;
            } catch (e) {
                console.log(e);
            }
        }

        return totalBytes;
    }

    static async dataToKilobytes(...data: any): Promise<number> {
        return await this.dataToBytes(...data) / 1024;
    }

    static async dataToMegabytes(...data: any): Promise<number> {
        return await this.dataToKilobytes(...data) / 1024;
    }

    static async isPrivateChannel(channel: string): Promise<boolean> {
        let isPrivate = false;

        for await (let pattern of this.privateChannelPatterns) {
            if (await this.matchesPattern(pattern, channel)) {
                isPrivate = true;
                break;
            }
        }

        return isPrivate;
    }

    static async isPresenceChannel(channel: string): Promise<boolean> {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    static async isEncryptedPrivateChannel(channel: string): Promise<boolean> {
        return channel.lastIndexOf('private-encrypted-', 0) === 0;
    }

    static async isCachingChannel(channel: string): Promise<boolean> {
        let isCachingChannel = false;

        for await (let pattern of this.cachingChannelPatterns) {
            if (await this.matchesPattern(pattern, channel)) {
                isCachingChannel = true;
                break;
            }
        }

        return isCachingChannel;
    }

    static async isClientEvent(event: string): Promise<boolean> {
        let isClientEvent = false;

        for await (let pattern of this.clientEventPatterns) {
            if (await this.matchesPattern(pattern, event)) {
                isClientEvent = true;
                break;
            }
        }

        return isClientEvent;
    }

    static generateSocketId(): string {
        let min = 0;
        let max = 10_000_000_000;
        let randomNumber = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

        return `${randomNumber(min, max)}.${randomNumber(min, max)}`;
    }

    static toOrderedArray(map: JsonObject): string[] {
        return Object.keys(map).map((key) => {
            return [key, map[key]];
        }).sort((a, b) => {
            if (a[0] < b[0]) {
                return -1;
            }

            if (a[0] > b[0]) {
                return 1;
            }

            return 0;
        }).map((pair) => {
            return pair[0] + "=" + pair[1];
        });
    }

    static getMD5(body: string): string {
        return crypto.createHash('md5')
            .update(body, 'utf8')
            .digest('hex');
    }
}
