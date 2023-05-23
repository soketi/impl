import { App } from './app';

export abstract class AppManager {
    abstract getById(id: string): Promise<App|null>;
    abstract getByKey(key: string): Promise<App|null>;
}
