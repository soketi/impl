# Gossiper

```js
Gossiper.registerProtocol(
    'GetDetails',
    ({ user_id }) => {
        return { user: await User.findOne(data.user_id) };
    },
);

let responses = await Gossiper.sendRequestToPeers('GetDetails', { user_id: 1 });

for await (let response of responses) {
    console.log(response);
}
```

```js
Gossiper.registerProtocol(
    'GetMemory',
    () => {
        return 10;
    },
);

let responses = await Gossiper.sendRequestToPeers('GetDetails', { user_id: 1 });

for await (let memory of responses) {
    console.log(memory);
}
```
