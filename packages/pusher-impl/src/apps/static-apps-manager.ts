import { App } from './app';
import type { AppsManager } from './apps-manager';
import type { AppSchema } from './schema';

export class StaticAppsManager implements AppsManager {
    constructor(
        protected apps: Required<App>[] = [],
    ) {
        //
    }

    async getById(id: string): Promise<Required<App>|null> {
        return this.apps.find(app => app.id === id) || null;
    }

    async getByKey(key: string): Promise<Required<App>|null> {
        return this.apps.find(app => app.key === key) || null;
    }

    async initializeApp(schema: AppSchema): Promise<Required<App>> {
        return App.load(schema);
    }

    async startup(): Promise<void> {
        //
    }

    async cleanup(): Promise<void> {
        //
    }
}
