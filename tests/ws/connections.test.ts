import { Connection, Connections } from '../../src/ws';
import { describe, test, expect } from 'vitest';

describe('ws/connections', () => {
    test('newConnection', async () => {
        const connections = new LocalConnections();
        const conn = new Connection('test', { id: 'test' });

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);
    });

    test('removeConnection', async () => {
        const connections = new LocalConnections();
        const conn = new Connection('test', { id: 'test' });

        await connections.newConnection(conn);
        expect(connections.connections.get('test')).toBe(conn);

        await connections.removeConnection(conn);
        expect(connections.connections.get('test')).toBeUndefined();
    });
});

class LocalConnections extends Connections {
    async getPeers(): Promise<string[]> {
        return [];
    }
}
