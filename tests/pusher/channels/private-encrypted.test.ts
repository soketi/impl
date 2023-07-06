/* eslint-disable @typescript-eslint/no-var-requires */
import type * as FN from '../../../types';
import { Gossiper } from '../../../src/gossiper';
import { App, AppsManager, AppsRegistry } from '../../../src/pusher/apps';
import { PusherConnection, PusherConnections } from '../../../src/pusher/ws';
import { Router as WsRouter } from '../../../src/ws';
import { describe, test, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { Brain, LocalBrain } from '../../../src/brain';

const pusherUtil = require('pusher/lib/util');
const Pusher = require('pusher');

let apps: TestAppsManager;
let gossiper: NoGossiper;
let brain: Brain;

beforeEach(() => {
    apps = new TestAppsManager();
    gossiper = new NoGossiper();
    brain = new LocalBrain();

    AppsRegistry.registerDriver('default', apps);
    AppsRegistry.initializeApp({}).then((app: TestApp) => {
        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);
    });

    gossiper.registerProtocol({
        protocol: 'callMethod',
        responseResolver: async (payload) => {
            console.log(payload);
            return {};
        },
    });
});

describe('pusher/channels/private-encrypted', () => {
    test('join and leave', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const conns = new LocalConnections(app, gossiper, brain);

        const conn = new PusherConnection('test', {
            send: (message) => {
                expect(message).toEqual(JSON.stringify({
                    event: 'pusher_internal:subscription_succeeded',
                    channel: 'private-encrypted-1',
                }));
                done();
            },
            close: (code, reason) => {
                //
            },
        });

        await conns.subscribeToChannel(conn, {
            event: 'pusher:subscribe',
            data: {
                channel: 'private-encrypted-1',
                auth: app.key + ':' + (await app.createToken(`${conn.id}:private-encrypted-1`)),
            },
        });

        expect([...conn.subscribedChannels]).toEqual(['private-encrypted-1']);
        expect(conn.presence).toEqual(new Map());
        expect(conns.channels.get('private-encrypted-1')).lengthOf(1);

        await conns.unsubscribeFromChannel(conn, 'private-encrypted-1');

        expect([...conn.subscribedChannels]).toEqual([]);
        expect(conn.presence).toEqual(new Map());
        expect(conns.channels.get('private-encrypted-1')).toBeUndefined();
    }));

    test('connect and disconnect', async () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const conns = new LocalConnections(app, gossiper, brain);

        WsRouter.onConnectionClosed(async (conn) => {
            await conns.unsubscribeFromAllChannels(conn);
        });

        const conn = new PusherConnection('test', {
            send: (message) => {
                //
            },
            close: async (code, reason) => {
                await WsRouter.handleConnectionClosed(conn, code, reason);
                expect(code).toEqual(1000);
                expect(reason).toEqual('test');
                expect([...conn.subscribedChannels]).toEqual([]);
                expect(conn.presence).toEqual(new Map());
                expect(conns.channels.get('private-encrypted-1')).toBeUndefined();
                done();
            },
        });

        await conns.subscribeToChannel(conn, {
            event: 'pusher:subscribe',
            data: {
                channel: 'private-encrypted-1',
                auth: app.key + ':' + (await app.createToken(`${conn.id}:private-encrypted-1`)),
            },
        });

        expect([...conn.subscribedChannels]).toEqual(['private-encrypted-1']);
        expect(conn.presence).toEqual(new Map());
        expect(conns.channels.get('private-encrypted-1')).lengthOf(1);

        conn.close(1000, 'test');
    }));

    test('connect but get unauthorized', async () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const conns = new LocalConnections(app, gossiper, brain);

        const conn = new PusherConnection('test', {
            send: (message) => {
                const data = JSON.parse(message);

                expect([...conn.subscribedChannels]).toEqual([]);
                expect(conn.presence).toEqual(new Map());
                expect(conns.channels.get('private-encrypted-1')).toBeUndefined();

                expect(data.event).toEqual('pusher:subscription_error');
                expect(data.channel).toEqual('private-encrypted-1');
                expect(data.data).toEqual({
                    error: 'The connection is unauthorized.',
                    status: 401,
                    type: 'AuthError',
                });
                done();
            },
            close: async (code, reason) => {
                //
            },
        });

        await conns.subscribeToChannel(conn, {
            event: 'pusher:subscribe',
            data: {
                channel: 'private-encrypted-1',
                auth: 'invalid',
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
        return (new Pusher.Token(this.key, this.secret)).sign(params);
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
        return [];
    }
}
