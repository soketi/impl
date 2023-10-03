import { Server } from './server';
import { waterfall } from 'async';
import { Utils } from '@soketi/impl/utils';
import type { App, AppsManager } from '@soketi/pusher-impl/apps';

import {
    type Brain,
    type JsonObject,
    type JsonStringifiable,
} from '@soketi/impl-interfaces';

import {
    App as WsApp,
    us_listen_socket_close,
    type TemplatedApp,
    type HttpRequest,
    type HttpResponse,
} from 'uWebSockets.js';
import { PusherConnection, type PusherConnections } from '@soketi/pusher-impl/ws';
import type { AnyPusherEventFromConnection, AnyPusherSubscriptionEvent, PusherClientEvent, PusherSignin } from '@soketi/pusher-impl';
import { PusherUtils } from '@soketi/pusher-impl/pusher-utils';

import queryString from 'query-string';
import type { PusherIpfsGossiper } from '@soketi/pusher-impl/src/gossiper';

export interface PusherWebSocketData<CID extends string = string> {
    id: CID;
    ip?: string;
    ip2?: string;
    appKey: string;
    namespace: string;
};

export type AsyncParameters = {
    res: PusherHttpResponse;
    req: HttpRequest;
    params: string[];
};

export type PusherHttpResponse = HttpResponse & {
    json: JsonStringifiable|null;
    rawBody: string|null;
    params: JsonObject;
    query: JsonObject;
    method: string;
    url: string;
    app: Required<App>;
};

export const responseCodes: Record<number, string> = {
    200: 'OK',
    400: 'Bad Request',
	401: 'Unauthorized',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	411: 'Length Required',
	413: 'Payload Too Large',
	422: 'Unprocessable Entity',
	426: 'Upgrade Required',
    429: 'Too Many Requests',
    500: 'Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
};

export class PusherMicroWebsocketServer<
    CID extends PusherConnection['id'] = PusherConnection['id'],
    Cs extends PusherConnections = PusherConnections,
    B extends Brain = Brain,
    G extends PusherIpfsGossiper = PusherIpfsGossiper,
> extends Server<Cs, B, G> {
    server!: TemplatedApp;
    socket: any;

    constructor(
        public readonly brain: B,
        public readonly gossiper: G,
        public readonly connections: Cs,
        public readonly appsManager: AppsManager,
    ) {
        super(brain, gossiper, connections);

        this.server = WsApp();
    }

    async start(signalHandler?: () => Promise<void>): Promise<void> {
        return new Promise(async resolve => {
            await this.registerWebsocketRoutes();
            await this.registerHttpRoutes();

            this.server.get('/p2p', async (res, req) => {
                res.writeHeader('Content-Type', 'application/json');
                res.writeStatus('200 OK');
                res.end(JSON.stringify(await this.gossiper.peers()));
            });

            await super.start(signalHandler);

            this.server.listen(Number(process.env.PORT || 6001), (socket) => {
                this.socket = socket;
                console.log(`Listening on port ${process.env.PORT || 6001}...`);
                resolve();
            });
        });
    }

    async closeServer(): Promise<void> {
        us_listen_socket_close(this.socket);
    }

    async registerWebsocketRoutes(): Promise<void> {
        this.server.ws<PusherWebSocketData<CID>>('/app/:appKey', {
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

                const connection = new PusherConnection(id, namespace, ws, {
                    close: async (code, reason) => {
                        try {
                            ws.end(code, reason);
                        } catch (e) {
                            //
                        }
                    },
                    send: async (message) => {
                        ws.send(
                            typeof message === 'string'
                                ? message
                                : JSON.stringify(message),
                            false,
                            true,
                        );
                    },
                });

                await this.gossiper.subscribeToNamespace(namespace, async (data) => {
                    // In case a message was broadcasted by a connection on this namespace,
                    // we will be notified. This way, we can broadcast the message to our local connections too.
                    // We are 100% sure that the message was not sent from one of our connections, because
                    // the self-broadcast is disabled.
                    if (data.event === 'pusher:channel:broadcast') {
                        this.connections.broadcastJsonMessageToChannel<PusherClientEvent>(
                            namespace,
                            data.payload?.message as PusherClientEvent,
                            [data.payload?.exceptingId as string],
                        );
                    }
                });

                await this.connections.newConnection(connection);
                await this.gossiper.announceNewConnection(namespace, id);

                console.log(`New connection: ${id}`);
            },
            message: async (ws, msg, isBinary) => {
                const { id, namespace } = ws.getUserData();
                const stringMessage = Utils.ab2str(msg);
                const conn = await this.connections.getConnection(namespace, id);

                if (!conn) {
                    return;
                }

                const message: AnyPusherEventFromConnection = JSON.parse(stringMessage);

                if (message.event === 'pusher:ping') {
                    conn.handlePong();
                } else if (message.event === 'pusher:subscribe') {
                    this.connections.subscribeToChannel(conn, message as AnyPusherSubscriptionEvent);
                } else if (message.event === 'pusher:unsubscribe') {
                    this.connections.unsubscribeFromChannel(conn, message.data.channel);
                } else if (message.event === 'pusher:signin') {
                    this.connections.handleSignin(conn, message as PusherSignin);
                } else if (await PusherUtils.isClientEvent(message.event)) {
                    this.connections.handleClientEvent(
                        conn,
                        message as PusherClientEvent,
                        this.gossiper.announceChannelBroadcast,
                    );
                } else {
                    //
                }

                console.log(`[${id}] ${isBinary ? 'Binary' : 'Text'} message: ${stringMessage}`);
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
            upgrade: async (res, req, context) => {
                const app = await this.appsManager.getByKey(req.getParameter(0));

                if (!app) {
                    res.end('Unknown app key.', true);
                    return;
                }

                res.upgrade<PusherWebSocketData>(
                    {
                        ip: Utils.ab2str(res.getRemoteAddressAsText()),
                        ip2: Utils.ab2str(res.getProxiedRemoteAddressAsText()),
                        id: String(PusherUtils.generateSocketId()),
                        appKey: req.getParameter(0),
                        namespace: app.id,
                    },
                    req.getHeader('sec-websocket-key'),
                    req.getHeader('sec-websocket-protocol'),
                    req.getHeader('sec-websocket-extensions'),
                    context,
                );
            },
        });
    }

    async registerHttpRoutes(): Promise<void> {
        /* app.get('/apps/:appId/channels', async (res, req) => {
            try {
                res = await this.attachMiddleware(res, req, ['appId'], [
                    this.corkMiddleware,
                    this.corsMiddleware,
                    this.appMiddleware,
                    this.authMiddleware,
                ]);
            } catch (e) {
                this.jsonEnd(res, { error: 'Server error encountered.' }, 500);
                console.error(e);
                return;
            }

            let response: { [channel: string]: ChannelResponse } = [
                ...[(await this.connections.namespaceApp(res.app.id))?.getChannelsWithConnectionsCount() || []],
            ].reduce((channels, [channel, connections]) => {
                if (connections === 0) {
                    return channels;
                }

                // In case ?filter_by_prefix= is specified, the channel must start with that prefix.
                if (res.query.filter_by_prefix && !channel.startsWith(res.query.filter_by_prefix)) {
                    return channels;
                }

                channels[channel] = {
                    subscription_count: connections,
                    occupied: true,
                };

                return channels;
            }, {});

            this.jsonEnd(res, { channels: response });
        }); */

        /* app.get('/apps/:appId/channels/:channel', async (res, req) => {
            try {
                res = await this.attachMiddleware(res, req, ['appId', 'channel'], [
                    this.corkMiddleware,
                    this.corsMiddleware,
                    this.appMiddleware,
                    this.authMiddleware,
                ]);
            } catch (e) {
                this.jsonEnd(res, { error: 'Server error encountered.' }, 500);
                console.error(e);
                return;
            }

            const connectionsCount = await this.connections[res.app.id].getChannelConnectionsCount(res.params.channel);
            let response: ChannelResponse;

            response = {
                subscription_count: connectionsCount,
                occupied: connectionsCount > 0,
            };

            // For presence channels, attach an user_count.
            // Avoid extra call to get channel members if there are no sockets.
            if (res.params.channel.startsWith('presence-')) {
                response.user_count = 0;

                if (response.subscription_count > 0) {
                    response.user_count = await this.connections[res.app.id].getChannelMembersCount(res.params.channel);
                }
            }

            this.jsonEnd(res, response);
        }); */

        this.server = this.server.post('/apps/:appId/events', async (res, req) => {
            try {
                res = await this.attachMiddleware(res, req, ['appId'], [
                    this.corkMiddleware,
                    this.jsonBodyMiddleware,
                    this.corsMiddleware,
                    this.appMiddleware,
                    this.authMiddleware,
                ]);
            } catch (e) {
                this.jsonEnd(res, { error: 'Server error encountered.' }, 500);
                console.error(e);
                return;
            }

            const json = res.json;
            const { name, channel, data } = json;

            if (!name || (!channel && !json.channels) || !data) {
                this.jsonEnd(res, { error: 'The required fields are: name, data, channel/channels.' }, 400);
                return;
            }

            const channels = channel ? [channel] : json.channels;

            for await (let ch of channels) {
                const messageToBroadcast: PusherClientEvent = {
                    event: name,
                    channel: ch,
                    data,
                };

                // Broadcast the message internally
                this.connections.broadcastJsonMessage<PusherClientEvent>(
                    res.app.id,
                    messageToBroadcast,
                    json.socket_id ? [json.socket_id] : [],
                );

                this.gossiper.announceChannelBroadcast<PusherClientEvent>(
                    messageToBroadcast,
                    res.app.key,
                    res.app.id,
                    json.socket_id,
                );
            }

            this.jsonEnd(res, { ok: true });
        });
    }

    protected jsonEnd(res: HttpResponse, data: any, status = 200) {
        try {
            return res.writeStatus(`${status} ${responseCodes[status]}`)
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify(data), true);
        } catch (e) {
            //
        }
    };

    protected async attachMiddleware(res: HttpResponse, req: HttpRequest, params: string[], functions: any[]): Promise<PusherHttpResponse> {
        let waterfallInit = (next: Function) => next(null, { res, req, params });

        let prepareResponseMiddleware = ({ res, req, params }: AsyncParameters, next: Function) => {
            res.params = params.reduce((obj, name, index) => {
                return {
                    ...obj,
                    [name]: req.getParameter(index),
                };
            }, {});

            res.query = queryString.parse(req.getQuery());
            res.method = req.getMethod().toUpperCase();
            res.url = req.getUrl();

            next(null, { res, req, params });
        };

        let abortHandlerMiddleware = ({ res, req, params }: AsyncParameters, next: Function) => {
            res.onAborted(() => {
                console.warn({ message: 'Aborted request.', res, req, params });
                this.jsonEnd(res, { error: 'Aborted request.' }, 400);
            });

            next(null, { res, req, params });
        };

        const response = await waterfall<AsyncParameters>([
            waterfallInit.bind(this),
            prepareResponseMiddleware.bind(this),
            abortHandlerMiddleware.bind(this),
            ...functions.map(fn => fn.bind(this)),
        ]);

        return response.res;
    }

    protected jsonBodyMiddleware({ res, req, params }: AsyncParameters, next: Function): any {
        this.readJson(
            res,
            async (newRes) => {
                next(null, { res: newRes, req, params });
            },
            (err: any) => {
                this.jsonEnd(res, 'The received data is incorrect.', 400);
                next(err, { res, req, params });
            },
        );
    }

    protected corkMiddleware({ res, req, params }: AsyncParameters, next: Function): any {
        res.cork(() => next(null, { res, req, params }));
    }

    protected corsMiddleware({ res, req, params }: AsyncParameters, next: Function): any {
        res.writeHeader('Access-Control-Allow-Origin', '*');
        res.writeHeader('Access-Control-Allow-Methods', '*');
        res.writeHeader('Access-Control-Allow-Headers', '*');
        next(null, { res, req, params });
    }

    protected async appMiddleware({ res, req, params }: AsyncParameters): Promise<any> {
        return new Promise<AsyncParameters>(async (resolve, reject) => {
            const validApp = await this.appsManager.getById(res.params.appId);

            if (!validApp) {
                this.jsonEnd(res, `The app ${res.params.appId} could not be found.`, 404);
                return reject();
            }

            res.app = validApp;

            resolve({ res, req, params });
        });
    }

    protected async authMiddleware({ res, req, params }: AsyncParameters): Promise<any> {
        return new Promise<AsyncParameters>(async (resolve, reject) => {
            const paramsToSign: JsonObject = {
                auth_key: res.app.key,
                auth_timestamp: res.query.auth_timestamp,
                auth_version: res.query.auth_version,
                ...res.query,
            };

            delete paramsToSign['auth_signature'];
            delete paramsToSign['body_md5']
            delete paramsToSign['appId'];
            delete paramsToSign['appKey'];
            delete paramsToSign['channelName'];

            const rawBody = res.rawBody;

            if (rawBody) {
                paramsToSign['body_md5'] = PusherUtils.getMD5(rawBody);
            }

            const correctToken = await res.app.createToken([
                res.method,
                res.url,
                PusherUtils.toOrderedArray(paramsToSign).join('&'),
            ].join("\n"));

            if (correctToken !== res.query.auth_signature) {
                this.jsonEnd(res, { error: 'Invalid signature.' }, 401);
                return reject();
            }

            this.connections.apps.set(res.app.id, res.app);

            resolve({ res, req, params });
        });
    }

    protected readJson(res: PusherHttpResponse, cb: (res: PusherHttpResponse) => Promise<any>, err: any) {
        let buffer: Buffer;

        res.onData((ab, isLast) => {
            let chunk = Buffer.from(ab);

            if (isLast) {
                res.json = {};
                res.rawBody = '';

                if (buffer) {
                    try {
                        // @ts-ignore
                        json = JSON.parse(Buffer.concat([buffer, chunk]));
                    } catch (e) {
                        //
                    }

                    try {
                        res.rawBody = Buffer.concat([buffer, chunk]).toString();
                    } catch (e) {
                        //
                    }

                    cb(res);
                } else {
                    try {
                        // @ts-ignore
                        res.json = JSON.parse(chunk);
                        res.rawBody = chunk.toString();
                    } catch (e) {
                        //
                    }

                    cb(res);
                }
            } else {
                if (buffer) {
                    buffer = Buffer.concat([buffer, chunk]);
                } else {
                    buffer = Buffer.concat([chunk]);
                }
            }
        });

        res.onAborted(err);
    }
}
