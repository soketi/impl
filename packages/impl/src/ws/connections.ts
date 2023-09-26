import { Utils } from '../utils';
import {
    type Connections as ConnectionsInterface,
    type Connection,
} from '@soketi/impl-interfaces';

export class Connections<
    C extends Connection = Connection,
    Message = any,
> implements ConnectionsInterface<C, Message> {
    readonly connections = new Map<string, C>();

    async newConnection(conn: C): Promise<void> {
        this.connections.set(conn.id, conn);
    }

    async removeConnection(conn: C): Promise<void> {
        this.connections.delete(conn.id);
    }

    async drainConnections(maxPerSecond = 1000, message?: string, code?: number): Promise<void> {
        Utils.chunkArray<C>(
            [...this.connections.values()],
            maxPerSecond,
            async chunks => {
                await Promise.allSettled(chunks.map(conn => conn.close(code, message)));
                await new Promise(resolve => setTimeout(resolve, 1e3));
            },
        );
    }

    async getConnection(id: C['id']): Promise<C|undefined> {
        return this.connections.get(id);
    }

    async close(
        id: C['id'],
        code?: number,
        reason?: string,
    ): Promise<void> {
        (await this.getConnection(id))?.close(code, reason);
    }

    async closeAll(code?: number, reason?: string): Promise<void> {
        await Promise.allSettled(
            [...this.connections.values()].map(conn => conn.close(code, reason)),
        );
    }

    async send(
        id: C['id'],
        message: Message,
    ): Promise<void> {
        (await this.getConnection(id))?.send(message);
    }

    async sendJson(
        id: C['id'],
        message: Message,
    ): Promise<void> {
        (await this.getConnection(id))?.sendJson(message);
    }

    async sendError(
        id: C['id'],
        message: Message,
        code?: number,
        reason?: string,
    ): Promise<void> {
        (await this.getConnection(id))?.sendError(message, code, reason);
    }

    async broadcastMessage(
        message: Message,
        exceptions?: C['id'][],
    ): Promise<void> {
        if (!exceptions || exceptions.length === 0) {
            return Promise.allSettled(
                [...this.connections.values()].map(conn => conn.send(message)),
            ).then(() => {
                //
            });
        }

        await Promise.allSettled(
            [...this.connections.values()]
                .filter(conn => !exceptions.includes(conn.id))
                .map(conn => conn.send(message)),
        );
    }

    async broadcastJsonMessage(
        message: Message,
        exceptions?: C['id'][],
    ): Promise<void> {
        if (!exceptions || exceptions.length === 0) {
            return Promise.allSettled(
                [...this.connections.values()].map(conn => conn.sendJson(message)),
            ).then(() => {
                //
            });
        }

        await Promise.allSettled(
            [...this.connections.values()]
                .filter(conn => !exceptions.includes(conn.id))
                .map(conn => conn.sendJson(message)),
        );
    }

    async broadcastError(
        message: Message,
        code?: number,
        reason?: string,
        exceptions?: C['id'][],
    ): Promise<void> {
        if (!exceptions || exceptions.length === 0) {
            return Promise.allSettled(
                [...this.connections.values()].map(conn => conn.sendError(message, code, reason)),
            ).then(() => {
                //
            });
        }

        await Promise.allSettled(
            [...this.connections.values()]
                .filter(conn => !exceptions.includes(conn.id))
                .map(conn => conn.sendError(message, code, reason)),
        );
    }
}
