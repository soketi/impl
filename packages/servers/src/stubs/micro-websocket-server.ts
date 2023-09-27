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
    namespace: string;
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
                .ws<WebSocketData<CID>>('/:namespace', {
                    sendPingsAutomatically: true,
                    idleTimeout: 120,
                    close: async (ws, code, message) => {
                        const { id, namespace } = ws.getUserData();
                        const connection = await this.connections.getConnection(namespace, id);

                        if (!connection) {
                            return;
                        }

                        await this.connections.removeConnection(connection, async () => {
                            await this.gossiper.unsubscribeFromNamespace(namespace);
                        });

                        console.warn(`[${id}] Closed: ${Utils.ab2str(message)} (${code})`);
                    },
                    open: async (ws) => {
                        const { id, namespace } = ws.getUserData();

                        const connection = new Connection(id, namespace, ws, {
                            close: async (code, reason) => {
                                try {
                                    ws.end(code, reason);
                                } catch (e) {
                                    //
                                }
                            },
                            send: async (message) => {
                                ws.send(JSON.stringify(message), false, true);
                            },
                        });

                        if (!this.connections.hasNamespace(namespace)) {
                            // Subscribe to this namespace.
                            await this.gossiper.subscribeToNamespace(namespace, async (data) => {
                                // In case a message was broadcasted by a connection on this namespace,
                                // we will be notified. This way, we can broadcast the message to our local connections too.
                                // We are 100% sure that the message was not sent from one of our connections, because
                                // the self-broadcast is disabled.
                                if (data.event === 'message:incoming') {
                                    this.connections.broadcastJsonMessage(
                                        namespace,
                                        JSON.parse(data.payload?.message as string),
                                    );
                                }
                            });
                        }

                        await this.connections.newConnection(connection);
                        await this.gossiper.announceNewConnection(namespace, id);

                        console.log(`New connection: ${id}`);
                    },
                    message: async (ws, message, isBinary) => {
                        const { id, namespace } = ws.getUserData();
                        const msg = Utils.ab2str(message);

                        this.connections.broadcastMessage(namespace, msg, [id]);
                        this.gossiper.announceNewMessage(namespace, id, msg);

                        console.log(`[${id}] ${isBinary ? 'Binary' : 'Text'} message: ${msg}`);
                    },
                    subscription: (ws, topic, newCount, oldCount) => {
                        // TODO: Implement?
                    },
                    ping: async (ws, message) => {
                        const { id, namespace } = ws.getUserData();
                        const connection = await this.connections.getConnection(namespace, id);

                        if (!connection) {
                            return;
                        }

                        await connection.updateTimeout();
                        console.log(`[${id}] Ping: ${Utils.ab2str(message)}`);
                    },
                    pong: async (ws, message) => {
                        const { id, namespace } = ws.getUserData();
                        const connection = await this.connections.getConnection(namespace, id);

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
                                namespace: req.getParameter(0),
                            },
                            req.getHeader('sec-websocket-key'),
                            req.getHeader('sec-websocket-protocol'),
                            req.getHeader('sec-websocket-extensions'),
                            context,
                        );
                    },
                });

            await super.start(signalHandler);

            this.server.listen(Number(process.env.PORT || 6001), (socket) => {
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
