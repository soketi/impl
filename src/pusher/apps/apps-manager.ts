import type * as FN from '@soketi/impl';
import { App } from './app';

export abstract class AppsManager {
    abstract getById(id: string): Promise<App|null>;
    abstract getByKey(key: string): Promise<App|null>;
    abstract initializeApp(scheme: FN.Pusher.PusherApps.AppScheme): Promise<FN.Pusher.PusherApps.App>;
}
