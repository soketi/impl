export class Utils {
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

    static matchesPattern(pattern: string, string: string): boolean {
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
            if (this.matchesPattern(pattern, channel)) {
                isPrivate = true;
                break;
            }
        }

        return isPrivate;
    }

    static isPresenceChannel(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    static isEncryptedPrivateChannel(channel: string): boolean {
        return channel.lastIndexOf('private-encrypted-', 0) === 0;
    }

    static async isCachingChannel(channel: string): Promise<boolean> {
        let isCachingChannel = false;

        for await (let pattern of this.cachingChannelPatterns) {
            if (this.matchesPattern(pattern, channel)) {
                isCachingChannel = true;
                break;
            }
        }

        return isCachingChannel;
    }

    static async isClientEvent(event: string): Promise<boolean> {
        let isClientEvent = false;

        for await (let pattern of this.clientEventPatterns) {
            if (this.matchesPattern(pattern, event)) {
                isClientEvent = true;
                break;
            }
        }

        return isClientEvent;
    }
}
