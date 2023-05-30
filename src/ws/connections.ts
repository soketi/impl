import type * as FN from '@soketi/impl/types';

export abstract class Connections implements FN.WS.Connections {
    readonly connections: Map<string, FN.WS.Connection> = new Map();

    async newConnection(conn: FN.WS.Connection): Promise<void> {
        this.connections.set(conn.id, conn);
    }

    async removeConnection(conn: FN.WS.Connection): Promise<void> {
        this.connections.delete(conn.id);
    }

    abstract getPeers(): Promise<string[]>;
}
