import { LocalBrain } from '../../src/brain';
import { BrainMetrics } from '../../src/metrics';
import { Connection, Connections } from '../../src/ws';
import { describe, test, expect } from 'vitest';

describe('ws/connection', () => {
    test('send', () => new Promise<void>(async (resolve) => {
        const connections = new LocalConnections();
        const brain = new LocalBrain();
        const metrics = new BrainMetrics(brain, connections);

        const conn = new Connection('test', {
            send: async (message: string) => {
                expect(message).toBe('test');

                await metrics.increment('test', 'sent_messages');
                await metrics.snapshot('test');

                expect(await metrics.get('test')).toEqual({
                    total_connections: 1,
                    sent_messages: {
                        [`d:${(new Date).getUTCDay().toString()}`]: {
                            [`h:${(new Date).getUTCHours().toString()}`]: 1,
                        },
                    },
                });

                resolve();
            },
        });

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);

        await connections.connections.get('test')?.send('test');
    }));

    test('close', () => new Promise<void>(async (resolve) => {
        const connections = new LocalConnections();
        const conn = new Connection('test', {
            close: (code?: number, reason?: string) => {
                expect(code).toBe(1000);
                expect(reason).toBe('test');
                resolve();
            },
        });

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);

        await connections.connections.get('test')?.close(1000, 'test');
    }));

    test('sendJson', () => new Promise<void>(async (resolve) => {
        const connections = new LocalConnections();
        const conn = new Connection('test', {
            send: (message: string) => {
                expect(message).toBe('{"test":"test"}');
                resolve();
            },
        });

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);

        await connections.connections.get('test')?.sendJson({ test: 'test' });
    }));

    test('sendError', () => new Promise<void>(async (resolve) => {
        const connections = new LocalConnections();
        const conn = new Connection('test', {
            send: (message: string) => {
                expect(message).toBe('{"message":"test","code":1000,"reason":"test"}');
            },
            close: (code?: number, reason?: string) => {
                expect(code).toBe(1000);
                expect(reason).toBe('test');
                resolve();
            },
        });

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);

        await connections.connections.get('test')?.sendError('test', 1000, 'test');
    }));

    test('toRemote', async () => {
        const connections = new LocalConnections();
        const conn = new Connection('test', {});

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);

        const remote = await connections.connections.get('test')?.toRemote();
        expect(remote).toEqual({ id: 'test' });
    });
});

class LocalConnections extends Connections {
    async getPeers(): Promise<string[]> {
        return [];
    }
}
