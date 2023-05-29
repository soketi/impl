# Soketi Implementation

Soketi Implementation is a TypeScript boilerplate to use on your WebSocket implementations. This represents a customizable single point of entry for your server, no matter what framework you are using.

## General Implementations

The package comes with default implementations for the usual WebSocket operations, but as well as specific ones, like Pusher.

This is not providing a WebSocket server, but rather a way to implement your own WebSocket server, no matter what framework you are using.

In the examples, we will assume a pseudo-WebSocket server (not tied to any real use case).

### Connections

This implementation provides a tracking of connections for the server:

```js
import { Connections, Connection } from '@soketi/soketi-impl';

const conns = new Connections();

server.on('new-connection', async originalConnection => {
    // Generate a unique ID for the connection.
    const uniqueId = Math.random() * 1e5;

    // If possible, associate the unique ID with the original connection.
    // This can be used later to get the connection.
    originalConnection.id = uniqueId;

    // Create a new connection instance, binding
    // the send and close methods to the underlying WebSocket.
    const connection = new Connection(uniqueId, {
        id: uniqueId,
        send: (message) => originalConnection.send(message),
        close: (...args) => originalConnection.close(...args),
    });

    // Add the connection to the connections tracker.
    await conns.newConnection(connection);
});
```

This way, you can track connections and send messages to them:

```js
for (const conn of conns.connections) {
    // .send will call the send method of the underlying WebSocket.
    await conn.send('Hello!');
}
```

To undo and remove a connection from the tracker, you can use `removeConnection`:

```js
await conns.removeConnection(connection);
```

### Handlers for Websocket events

The package provides a way to handle WebSocket events at the general level,
so that you don't have to implement them yourself. You will be defining both
the handlers, as well as the calls to them, in a static way.

```js
import { Router as WsRouter } from '@soketi/soketi-impl';
import { Connections, Connection } from '@soketi/soketi-impl';

const conns = new Connections();

WsRouter.onNewConnection(async conn => {
    // As explained earlier in the connections, you can use it to add it to a tracker.
    await conns.newConnection(conn);
    await conn.send('Hello!');
});

server.on('new-connection', async originalConnection => {
    const connection = new Connection(...);

    // Handle the connection via the router.
    // This will call the handler defined above.
    await WsRouter.handleNewConnection(connection);
});
```

The router provides handlers for the following events:

- `onNewConnection(async conn => {})` with `handleNewConnection(connection)`
- `onConnectionClosed(async (conn, code, msg) => {})` with `handleConnectionClosed(connection, code, msg)`
- `onMessage(async (conn, message) => {})` with `handleMessage(connection, message)`
- `onError(async (conn, error) => {})` with `handleError(connection, error)`

You can also register your own handlers:

```js
import { Router as WsRouter } from '@soketi/soketi-impl';

// Register a ping handler.
WsRouter.registerHandler('onPing', async conn => {
    await conn.send('Pong!');
});

server.on('ping', async originalConnection => {
    // Get the existing connection on a ping or message.
    if (conns.connections.get(originalConnection.id)) {
        await WsRouter.getProtocol('onPing').handle(connection);
    }
});
```

### Pusher

- Public Channels ✅
- Presence Channels ✅
- Private Channels ✅
- Encrypted Private Channels ✅
- Client Events ✅
- Webhooks ❌
- REST API ❌
- Metrics ❌

See more: [Pusher Channels](https://pusher.com/channels)
