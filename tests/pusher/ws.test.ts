/* eslint-disable @typescript-eslint/no-var-requires */
import type * as FN from '../../types';
import { Gossiper } from '../../src/gossiper';
import { App, AppsManager, AppsRegistry } from '../../src/pusher/apps';
import { PusherConnection, PusherConnections } from '../../src/pusher/ws';
import { describe, test, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { Brain, LocalBrain } from '../../src/brain';
import { PusherBrainMetrics } from '../../src/pusher';

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
});

describe('pusher/ws', () => {
    test('handle ping pongs', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const conns = new LocalConnections(app, gossiper, brain);

        const conn = new PusherConnection('test', {
            send: async (message) => {
                if (message.indexOf('pong') !== -1) {
                    expect(message).toBe('{"event":"pusher:pong","data":{}}');
                    done();
                }
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

        const conns = new LocalConnections(app, gossiper, brain);

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

    test('signin', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.initializeApp({ enableUserAuthentication: true });
        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);

        const conns = new LocalConnections(app, gossiper, brain);

        const userData = {
            id: 1,
            name: 'test',
        };

        const userDataAsString = JSON.stringify(userData);

        let messageData = async (connId) => ({
            auth: app.key + ':' + (await app.calculateSigninToken(connId, userDataAsString)),
            user_data: userDataAsString,
        });

        const conn = new PusherConnection('test', {
            send: async (message) => {
                if (message.indexOf('pusher:signin_success') !== -1) {
                    expect(message).toBe(JSON.stringify({
                        event: 'pusher:signin_success',
                        data: await messageData(conn.id),
                    }));
                    done();
                }
            },
            close: (code, reason) => {
                //
            },
        });

        await conns.newConnection(conn);
        await conns.handleSignin(conn, {
            event: 'pusher:signin',
            data: await messageData(conn.id),
        });
    }));

    test('signin but dont process signin', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.initializeApp({
            enableUserAuthentication: true,
            userAuthenticationTimeout: 2_000,
        });

        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);

        const conns = new LocalConnections(app, gossiper, brain);

        const conn = new PusherConnection('test', {
            send: async (message) => {
                //
            },
            close: (code, reason) => {
                expect(code).toBe(4009);
                done();
            },
        });

        await conns.newConnection(conn);

        await new Promise((resolve) => setTimeout(resolve, 2100));
    }));

    test('terminate user connections', () => new Promise<void>(async (done) => {
        const app = await AppsRegistry.initializeApp({ enableUserAuthentication: true });
        apps.apps.set('app-id', app);
        apps.apps.set('app-key', app);

        const conns = new LocalConnections(app, gossiper, brain);

        const userData = {
            id: 1,
            name: 'test',
        };

        const userDataAsString = JSON.stringify(userData);

        let messageData = async (connId) => ({
            auth: app.key + ':' + (await app.calculateSigninToken(connId, userDataAsString)),
            user_data: userDataAsString,
        });

        const conn = new PusherConnection('test', {
            send: async (message) => {
                if (message.indexOf('pusher:signin_success') !== -1) {
                    expect(message).toBe(JSON.stringify({
                        event: 'pusher:signin_success',
                        data: await messageData(conn.id),
                    }));

                    await conns.terminateUserConnections(userData.id);
                }
            },
            close: (code, reason) => {
                expect(code).toBe(4009);
                expect(reason).toBe('You got disconnected by the app.');
                done();
            },
        });

        await conns.newConnection(conn);
        await conns.handleSignin(conn, {
            event: 'pusher:signin',
            data: await messageData(conn.id),
        });
    }));

    test('join and leave triggers metrics change', async () => {
        const app = await AppsRegistry.getById('app-id') as TestApp;
        const conns = new LocalConnections(app, gossiper, brain);
        const metrics = new PusherBrainMetrics(brain, conns);

        const conn = new PusherConnection('test', {
            send: (message) => {
                //
            },
            close: (code, reason) => {
                //
            },
        });

        await conns.newConnection(conn);

        await conns.subscribeToChannel(conn, {
            event: 'pusher:subscribe',
            data: {
                channel: 'test',
            },
        });

        expect([...conn.subscribedChannels]).toEqual(['test']);
        expect(conn.presence).toEqual(new Map());
        expect(conns.channels.get('test')).lengthOf(1);

        await metrics.snapshot(app.id);
        expect(await metrics.get(app.id)).toEqual({
            total_connections: 1,
            channels: [{
                channel: 'test',
                connections: 1,
            }],
            users: [],
            started: conns.started.toISOString(),
        });

        await conns.unsubscribeFromChannel(conn, 'test');

        expect([...conn.subscribedChannels]).toEqual([]);
        expect(conn.presence).toEqual(new Map());
        expect(conns.channels.get('test')).toBeUndefined();

        await metrics.snapshot(app.id);
        expect(await metrics.get(app.id)).toEqual({
            total_connections: 1,
            channels: [],
            users: [],
            started: conns.started.toISOString(),
        });

        await conns.removeConnection(conn);

        await metrics.snapshot(app.id);
        expect(await metrics.get(app.id)).toEqual({
            total_connections: 0,
            channels: [],
            users: [],
            started: conns.started.toISOString(),
        });
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

class NoGossiper extends Gossiper {
    async sendRequestToPeers(
        protocol: string,
        peers: string[],
        message: FN.Gossip.Payload,
    ): Promise<FN.Gossip.Response[]> {
        return []
    }
}
