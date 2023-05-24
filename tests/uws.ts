import { Connection } from '@/ws/connection';
import { Connections } from '@/ws/connections';
import uWS, {
    App,
} from 'uWebSockets.js';

const app = uWS.App();
const connections = new Connections();

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
        // const conn = new Connection('' + Math.random() * 100000, ws.);
    },
    message: (ws, message, isBinary) => {
        //
    },
    drain: (ws) => {
        //
    },
    close: (ws, code, message) => {
        //
    },
});



app.listen(9001, (token) => {
    if (token) {
        console.log('Listening to port 9001');
    } else {
        console.log('Failed to listen to port 9001');
    }
});
