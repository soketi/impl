import { App } from './app';
import { type AppSchema } from './schema';

export abstract class AppsManager {
    abstract getById(id: string): Promise<Required<App>|null>;
    abstract getByKey(key: string): Promise<Required<App>|null>;
    abstract initializeApp(scheme: AppSchema): Promise<Required<App>>;

    async startup(): Promise<void> {
        //
    }

    async cleanup(): Promise<void> {
        //
    }
}
