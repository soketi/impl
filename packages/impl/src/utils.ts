export class Utils {
    static async chunkArray<Item = any>(
        array: Item[],
        chunkSize: number,
        callback: (chunks: Item[]) => Promise<void>,
    ): Promise<void> {
        Array.from(
            { length: Math.ceil(array.length / chunkSize) },
            async (_, index) => await callback(array.slice(index * chunkSize, (index + 1) * chunkSize)),
        );
    }

    static ab2str(buffer: ArrayBuffer): string {
        return Buffer.from(buffer).toString('utf-8');
    }

    static async waitGracefullyFor(
        callback: () => Promise<boolean>,
        interval = 1e3,
        maxRetries = 30,
    ): Promise<void> {
        await new Promise<void>(async (resolve, reject) => {
            let tries = 0;

            const i = setInterval(async () => {
                const callbackResponse = await callback();

                if (callbackResponse === true) {
                    clearInterval(i);
                    return resolve();
                }

                tries++;

                if (tries >= maxRetries) {
                    clearInterval(i);
                    return reject();
                }
            }, interval);
        });
    }
}
