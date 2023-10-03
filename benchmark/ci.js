import { Trend } from 'k6/metrics';
import ws from 'k6/ws';

/**
 * 1. Run the PHP senders based on the amount of messages per second you want to receive.
 *    The sending rate influences the final benchmark.
 *
 * Low, 1 message per second:
 * php send --interval 1 --port 6001
 *
 * Mild, 2 messages per second:
 * php send --interval 0.5 --port 6002
 *
 * Overkill, 10 messages per second:
 * php send --interval 0.1 --port 6003
 */

const delayTrend = new Trend('message_delay_ms');

export const options = {
    thresholds: {
        message_delay_ms: [
            { threshold: `p(95)<100`, abortOnFail: false },
            { threshold: `avg<100`, abortOnFail: false },
        ],
    },

    scenarios: {
        // Keep connected many users users at the same time.
        soakTraffic: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '0s',
            stages: [
                { duration: '50s', target: 250 },
                { duration: '110s', target: 250 },
            ],
            env: {
                SLEEP_FOR: '160',
                WS_HOST: __ENV.WS_HOST || 'ws://127.0.0.1:6001/app/app-key',
            },
        },

        // Having high amount of connections and disconnections
        // representing active traffic that starts after 5 seconds
        // from the soakTraffic scenario.
        highTraffic: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '50s',
            stages: [
                { duration: '50s', target: 250 },
                { duration: '30s', target: 250 },
                { duration: '10s', target: 100 },
                { duration: '10s', target: 50 },
                { duration: '10s', target: 100 },
            ],
            gracefulRampDown: '20s',
            env: {
                SLEEP_FOR: '160',
                WS_HOST: __ENV.WS_HOST || 'ws://127.0.0.1:6001/app/app-key',
            },
        },
    },
};

export default () => {
    ws.connect(__ENV.WS_HOST, null, (socket) => {
        socket.setTimeout(() => {
            socket.close();
        }, __ENV.SLEEP_FOR * 1000);

        socket.on('open', () => {
            // Keep connection alive with pusher:ping
            socket.setInterval(() => {
                socket.send(JSON.stringify({
                    event: 'pusher:ping',
                    data: JSON.stringify({}),
                }));
            }, 30000);

            socket.on('message', message => {
                let receivedTime = Date.now();

                message = JSON.parse(message);

                if (message.event === 'pusher:connection_established') {
                    socket.send(JSON.stringify({
                        event: 'pusher:subscribe',
                        data: { channel: 'benchmark' },
                    }));
                }

                if (message.event === 'timed-message') {
                    let data = JSON.parse(message.data);

                    delayTrend.add(receivedTime - data.time);
                }
            });
        });
    });
}
