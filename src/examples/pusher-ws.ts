import type * as FN from '@soketi/impl';
import { App } from '@/pusher/apps/app';
import { AppsManager } from '@/pusher/apps/apps-manager';
import { AppsRegistry } from '@/pusher/apps/apps-registry';
import { Connection } from '@/ws/connection';
import { Connections } from '@/ws/connections';
import { Router } from '@/ws/router';
import uWS, {
    RecognizedString,
    WebSocket as uWebSocket,
} from 'uWebSockets.js';

const ab2str = require('arraybuffer-to-string');

// Example Local Apps Manager
class LocalAppsManager extends AppsManager {
    apps = new Map<string, App>();

    async getById(id: string): Promise<App|null> {
        return this.apps.get(id);
    }

    async getByKey(key: string): Promise<App|null> {
        return this.apps.get(key);
    }
}

// Initialize the managers
const conns = new Connections();
const apps = new LocalAppsManager();

// Register the WS Router events
const newConnectionFromUws = (ws: uWebSocket<any>) => {
    ws.id = '' + Math.random() * 100000;

    return new Connection(ws.id, {
        close: (code, reason) => ws.end(code, reason),
        send: (message) => ws.send(message as RecognizedString),
    });
};

Router.onNewConnection((connection) => {
    conns.newConnection(connection);
});

Router.onConnectionClosed((connection) => {
    conns.removeConnection(connection);
});

Router.onMessage((connection, message) => {
    console.log('Message', connection.id, message);
});

Router.onError((connection, error) => {
    console.log('Error', connection.id, error);
});

// Initialize the app
const app = uWS.App();

// Create apps
apps.apps.set('app-id', new App({}));
apps.apps.set('app-key', new App({}));

// Register the driver
AppsRegistry.registerDriver('default', apps);

app.ws('/app/:appKey', {
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 10,
    maxBackpressure: 1024,
    upgrade: (res, req, context) => {
        res.upgrade(
            {
                url: req.getUrl(),
                query: req.getQuery(),
                method: req.getMethod(),
                appKey: req.getParameter(0),
            },
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
            context,
        );
    },
    open: (ws) => {
        Router.handleNewConnection(newConnectionFromUws(ws));
    },
    message: (ws, message, isBinary) => {
        Router.handleMessage(conns.connections.get(ws.id), message);
    },
    drain: (ws) => {
        //
    },
    close: (ws, code, message) => {
        if (message instanceof ArrayBuffer) {
            try {
                message = JSON.parse(ab2str(message)) as FN.Pusher.PusherWS.PusherMessage;
            } catch (err) {
                return;
            }
        }

        Router.handleConnectionClosed(conns.connections.get(ws.id), code, message as unknown as string);
    },
});

app.listen(9001, (token) => {
    setInterval(() => {
        console.dir(conns.connections, { depth: 10 });
    }, 5_000);

    if (token) {
        console.log('Listening to port 9001');
    } else {
        console.log('Failed to listen to port 9001');
    }
});
