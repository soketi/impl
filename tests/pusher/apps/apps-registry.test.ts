/* eslint-disable @typescript-eslint/no-var-requires */
import type * as FN from '../../../types';
import { PusherConnections } from '../../../src/pusher/ws';
import { App, AppsManager, AppsRegistry } from '../../../src/pusher/apps';
import { describe, test, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

const pusherUtil = require('pusher/lib/util');
const Pusher = require('pusher');

let apps: TestAppsManager;

beforeEach(() => {
    apps = new TestAppsManager();

    AppsRegistry.registerDriver('default', apps);

    AppsRegistry.initializeApp({}).then((app: TestApp) => {
        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);
    });
});

describe('pusher/apps/apps-registry', () => {
    test('define app', async () => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        expect(app).toBeInstanceOf(App);
        expect(app).toBeInstanceOf(TestApp);
        expect(app.id).toBe('app-id');
        expect(app.key).toBe('app-key');
    });

    test('define app by key', async () => {
        const app = await AppsRegistry.getByKey('app-key') as TestApp;
        expect(app).toBeInstanceOf(App);
        expect(app).toBeInstanceOf(TestApp);
        expect(app.id).toBe('app-id');
        expect(app.key).toBe('app-key');
    });

    test('initializeApp', async () => {
        const appScheme = {
            id: 'app-id',
            key: 'app-key',
            secret: 'app-secret',
        };

        const app = await apps.initializeApp(appScheme) as TestApp;
        expect(app).toBeInstanceOf(App);
        expect(app).toBeInstanceOf(TestApp);
        expect(app.id).toBe('app-id');
        expect(app.key).toBe('app-key');
        expect(app.secret).toBe('app-secret');
    });

    test('toObject', async () => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const object = app.toObject();

        expect(object).toBeInstanceOf(Object);
        expect(object).toHaveProperty('id', 'app-id');
        expect(object).toHaveProperty('key', 'app-key');
        expect(object).toHaveProperty('secret', 'app-secret');

        const appFromObject = await apps.initializeApp(object) as TestApp;

        expect(appFromObject).toBeInstanceOf(App);
        expect(appFromObject).toBeInstanceOf(TestApp);
        expect(appFromObject.id).toBe('app-id');
        expect(appFromObject.key).toBe('app-key');
        expect(appFromObject.secret).toBe('app-secret');
    });
});

class LocalConnections extends PusherConnections {
    async getPeers(): Promise<string[]> {
        return [];
    }
}

class TestApp extends App {
    async calculateBodyMd5(body: string): Promise<string> {
        return pusherUtil.getMD5(body);
    }

    async createToken(params: string): Promise<string> {
        return new Pusher.Token(this.key, this.secret).sign(params);
    }

    async sha256(): Promise<string> {
        return createHmac('sha256', this.secret)
            .update(JSON.stringify(this.toObject()))
            .digest('hex');
    }
}

class TestAppsManager extends AppsManager {
    apps = new Map<string, TestApp>();

    async getById(id: string): Promise<App|null> {
        return this.apps.get(id) as App|null;
    }

    async getByKey(key: string): Promise<App|null> {
        return this.apps.get(key) as App|null;
    }

    async initializeApp(scheme: FN.Pusher.PusherApps.AppScheme): Promise<FN.Pusher.PusherApps.App> {
        return new TestApp(scheme);
    }
}
