# leopard
A FIFO queue with group-level concurrency support

## Install

```shell
$ npm install leopard
```

## Usage

Dispatcher:

```javascript
const Dispatcher = require('leopard').Dispatcher;
const dispatcher = new Dispatcher({
  port: 7446
});

ws.on('message', (message) => {
  const payload = {
    channel: file.guid,
    baseRev: 67,
    changeset: ''
  };
  dispatcher.send(payload).then((res) => {
    ws.sendToUsers({ padId: payload.channel }, {
      type: 'COLLABROOM',
      data: {
        type: 'NEW_CHANGES',
        changeset: res.changeset,
        newRev: res.newRev
      }
    });
  });
});
```

Worker:

```javascript
const Worker = require('leopard').Worker;

const worker = new Worker({
dispatcherPort: 7446,
  handler(payload) {
    return processChangeset(payload.task);
  }
});
```
