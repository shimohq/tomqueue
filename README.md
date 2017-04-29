# TomQueue
A FIFO queue with group-level concurrency support

## Install

```shell
$ npm install tomqueue
```

## Usage

Dispatcher:

```javascript
const Dispatcher = require('tomqueue').Dispatcher;
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
    console.log(res);
  }).catch(console.error);
}, 3000);
```

Worker:

```javascript
const Worker = require('tomqueue').Worker;
const worker = new Worker({
  handler(payload) {
    return processChangeset(payload);
  }
});

worker.start();

function processChangeset(data) {
  return Promise.resolve(data);
}
```

## Payload

The method `Dispatcher#send()` receives a payload object, which must contain a `channel` property representing which channel the payload should be sent to.

## Storage

TomQueue supports two storages. The default storage is memory based. To switch to the redis-based storage, set `storage` option to `"redis"`:

```javascript
const dispatcher = new Dispatcher({
  port: 7446,
  storage: 'redis',
  storageOptions: {
    redis: new Redis()
  }
});
```

## Options

### Dispatcher
* `port` **Optional** `Number` port the server listened.
* `storage` **Optional** `String` Dispatcher storage, it can be `memory` or `redis`, *storageOptions* is required if you use *redis*. default `memory`.
* `storageOptions` **Optional** `Object` should be an object with *redis*(as a redis instance) property.
* `timeout` **Optional** `Number` Dispatcher send timeout, default `1000` ms.

### Worker
* `handler` **Required** `Function` payload handler.
* `dispatcherPort` **Optional** `Number` Dispatcher server port.
* `dispatcherHost` **Optional** `String` Dispatcher server host.
* `retryStrategy` **Optional** `Function` return the time(ms) retry connect to dispatcher.


