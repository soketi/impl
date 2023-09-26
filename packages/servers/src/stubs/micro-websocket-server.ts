import { Server } from './server';
import { Connection } from '@soketi/impl/ws';
import { App, us_listen_socket_close, type TemplatedApp } from 'uWebSockets.js';
import { Utils } from '@soketi/impl/utils';
import { randomUUID } from 'crypto';
import {
    type Brain,
    type Connections,
    type Gossiper,
    type Prospector
} from '@soketi/impl-interfaces';

export interface WebSocketData<CID extends string = string> {
    id: CID;
    ip?: string;
    ip2?: string;
}

export class MicroWebsocketServer<
    CID extends string = string,
    Cs extends Connections = Connections,
    B extends Brain = Brain,
    G extends Gossiper = Gossiper,
    P extends Prospector = Prospector,
> extends Server<Cs, B, G, P> {
    server!: TemplatedApp;
    socket: any;

    async start(signalHandler?: () => Promise<void>): Promise<void> {
        return new Promise(async resolve => {
            this.server = App()
                .ws<WebSocketData<CID>>('/*', {
                    sendPingsAutomatically: true,
                    idleTimeout: 120,
                    close: async (ws, code, message) => {
                        const { id } = ws.getUserData();
                        const connection = await this.connections.getConnection(id);

                        if (!connection) {
                            return;
                        }

                        await this.connections.removeConnection(connection);

                        console.warn(`[${id}] Closed: ${Utils.ab2str(message)} (${code})`);
                    },
                    open: async (ws) => {
                        const { id } = ws.getUserData();

                        const connection = new Connection(id, ws, {
                            close: async (code, reason) => ws.end(code, reason),
                            send: async (message) => {
                                ws.send(JSON.stringify(message), false, true);
                            }
                        });

                        await this.connections.newConnection(connection);
                        console.log(`New connection: ${id}`);
                    },
                    message: async (ws, message, isBinary) => {
                        const { id } = ws.getUserData();

                        this.connections.broadcastMessage(message, [id]);

                        const msg = Utils.ab2str(message);
                        console.log(`[${id}] ${isBinary ? 'Binary' : 'Text'} message: ${msg}`);
                    },
                    subscription: (ws, topic, newCount, oldCount) => {
                        // TODO: Implement?
                    },
                    ping: async (ws, message) => {
                        const { id } = ws.getUserData();
                        const connection = await this.connections.getConnection(id);

                        if (!connection) {
                            return;
                        }

                        await connection.updateTimeout();
                        console.log(`[${id}] Ping: ${Utils.ab2str(message)}`);
                    },
                    pong: async (ws, message) => {
                        const { id } = ws.getUserData();
                        const connection = await this.connections.getConnection(id);

                        if (!connection) {
                            return;
                        }

                        await connection.updateTimeout();
                        console.log(`[${id}] Pong: ${Utils.ab2str(message)}`);
                    },
                    upgrade: (res, req, context) => {
                        res.upgrade<WebSocketData>(
                            {
                                ip: Utils.ab2str(res.getRemoteAddressAsText()),
                                ip2: Utils.ab2str(res.getProxiedRemoteAddressAsText()),
                                id: String(randomUUID()),
                            },
                            req.getHeader('sec-websocket-key'),
                            req.getHeader('sec-websocket-protocol'),
                            req.getHeader('sec-websocket-extensions'),
                            context,
                        );
                    },
                });

            await super.start(signalHandler);

            this.server.listen(6001, (socket) => {
                this.socket = socket;
                console.log('Listening on port 6001...');
                resolve();
            });
        });
    }

    async closeServer(): Promise<void> {
        us_listen_socket_close(this.socket);
    }
}
