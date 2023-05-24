import * as FN from '@soketi/impl';

export class Connections implements FN.WS.Connections {
    readonly connections: Map<string, FN.WS.Connection> = new Map();

    async newConnection(conn: FN.WS.Connection): Promise<void> {
        this.connections.set(conn.id, conn);
    }

    async removeConnection(conn: FN.WS.Connection): Promise<void> {
        this.connections.delete(conn.id);
    }
}
