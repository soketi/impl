import type * as FN from '@soketi/impl';
import { App } from './app';
import { AppsManager } from './apps-manager';

export class AppsRegistry {
    static drivers = new Map<string, AppsManager>();
    static currentDriver = 'default';

    static registerDriver(name: string, driver: AppsManager): void {
        this.drivers.set(name, driver);
    }

    static setDriver(name: string): void {
        this.currentDriver = name;
    }

    static getDriver(name?: string): AppsManager {
        let driver = this.drivers.get(name || this.currentDriver);

        if (!driver) {
            throw new Error(`AppManager driver "${name}" not found.`);
        }

        return driver;
    }

    static async getById(id: string): Promise<App|null> {
        return await this.getDriver().getById(id);
    }

    static async getByKey(key: string): Promise<App|null> {
        return await this.getDriver().getByKey(key);
    }

    static async initializeApp(scheme: FN.Pusher.PusherApps.AppScheme): Promise<FN.Pusher.PusherApps.App> {
        return await this.getDriver().initializeApp(scheme);
    }
}
