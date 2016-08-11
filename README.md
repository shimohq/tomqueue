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

dispatcher.start();

setTimeout(function () {
  const payload = {
    channel: 'abc',
    baseRev: 67,
    changeset: ''
  };
  dispatcher.send(payload).then((res) => {
    console.log('==res', res);
  }).catch(console.error);
}, 3000);
```

Worker:

```javascript
const Worker = require('leopard').Worker;
const worker = new Worker({
  handler(payload) {
    return processChangeset(payload);
  }
});

worker.start();

function processChangeset(data) {
  console.log('==!', data);
  return Promise.resolve(data);
}
```
