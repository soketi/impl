/* eslint-disable @typescript-eslint/no-var-requires */
import type * as FN from '../../types';
import { Gossiper } from '../../src/gossiper';
import { App, AppsManager, AppsRegistry } from '../../src/pusher/apps';
import { PusherConnection, PusherConnections } from '../../src/pusher/ws';
import { describe, test, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

const pusherUtil = require('pusher/lib/util');
const Pusher = require('pusher');

let apps: TestAppsManager;
let gossiper: NoGossiper;

beforeEach(() => {
    apps = new TestAppsManager();
    gossiper = new NoGossiper();

    AppsRegistry.registerDriver('default', apps);
    AppsRegistry.initializeApp({}).then((app: TestApp) => {
        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);
    });
});

describe('pusher/ws', () => {
    test('handle ping pongs', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const conns = new LocalConnections(app, gossiper);

        const conn = new PusherConnection('test', {
            send: async (message) => {
                expect(message).toBe('{"event":"pusher:pong","data":{}}');
                done();
            },
            close: (code, reason) => {
                //
            },
        });

        await conns.newConnection(conn);
        expect(conns.connections.get('test')).toBe(conn);

        await conn.handlePong();
    }));

    test('client events', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.initializeApp({ enableClientMessages: true });
        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);

        const conns = new LocalConnections(app, gossiper);

        const otherConn = new PusherConnection('other', {
            send: async (message) => {
                if (message.indexOf('client-test') !== -1) {
                    expect(message).toBe('{"event":"client-test","channel":"test","data":{"test":true}}');
                    done();
                }
            },
            close: (code, reason) => {
                //
            },
        });

        const conn = new PusherConnection('test', {
            send: async (message) => {
                //
            },
            close: (code, reason) => {
                //
            },
        });

        await conns.newConnection(conn);
        await conns.newConnection(otherConn);

        await conns.subscribeToChannel(conn, {
            event: 'pusher:subscribe',
            data: {
                channel: 'test',
            },
        });

        await conns.subscribeToChannel(otherConn, {
            event: 'pusher:subscribe',
            data: {
                channel: 'test',
            },
        });

        await conns.handleClientEvent(conn, {
            event: 'client-test',
            channel: 'test',
            data: {
                test: true,
            },
        });
    }));
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
        return Pusher.Token(this.key, this.secret).sign(params);
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

class NoGossiper extends Gossiper {
    async sendRequestToPeers(
        protocol: string,
        peers: string[],
        message: FN.Gossip.Payload,
    ): Promise<FN.Gossip.Response[]> {
        return []
    }
}
