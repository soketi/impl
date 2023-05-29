import { Connection, Connections, Router as WsRouter } from '../../src/ws';
import { describe, test, expect } from 'vitest';

describe('ws/router', () => {
    test('onNewConnection', () => new Promise<void>(async (done) => {
        WsRouter.onNewConnection(async (conn) => {
            expect(conn).toBeInstanceOf(Connection);
            expect(conn.id).toBe('test');
            done();
        });

        const connections = new LocalConnections();
        const conn = new Connection('test', { });

        await connections.newConnection(conn);
        WsRouter.handleNewConnection(conn);
    }));

    test('onConnectionClosed', () => new Promise<void>(async (done) => {
        WsRouter.onConnectionClosed(async (conn, code, message) => {
            expect(conn).toBeInstanceOf(Connection);
            expect(conn.id).toBe('test');
            expect(code).toBe(1000);
            expect(message).toBe('test');
            done();
        });

        const connections = new LocalConnections();
        const conn = new Connection('test', { });

        await connections.newConnection(conn);
        WsRouter.handleConnectionClosed(conn, 1000, 'test');
    }));

    test('onMessage', () => new Promise<void>(async (done) => {
        WsRouter.onMessage(async (conn, message) => {
            expect(conn).toBeInstanceOf(Connection);
            expect(conn.id).toBe('test');
            expect(message).toBe('test');
            done();
        });

        const connections = new LocalConnections();
        const conn = new Connection('test', { });

        await connections.newConnection(conn);
        WsRouter.handleMessage(conn, 'test');
    }));

    test('onError', () => new Promise<void>(async (done) => {
        WsRouter.onError(async (conn, error) => {
            expect(conn).toBeInstanceOf(Connection);
            expect(conn.id).toBe('test');
            expect(error).toBeInstanceOf(Error);
            done();
        });

        const connections = new LocalConnections();
        const conn = new Connection('test', { });

        await connections.newConnection(conn);
        WsRouter.handleError(conn, new Error());
    }));
});

class LocalConnections extends Connections {
    async getPeers(): Promise<string[]> {
        return [];
    }
}
