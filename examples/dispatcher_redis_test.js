'use strict';

const uuid = require('uuid');
const Redis = require('ioredis');
const Dispatcher = require('../').Dispatcher;
const dispatcher = new Dispatcher({
  storage: 'redis',
  storageOptions: {
    redis: new Redis()
  }
});

dispatcher.start();

setInterval(function () {
  const payloadId = uuid.v4();
  const payload = {
    channel: 'abc' + payloadId,
    rev: payloadId
  };
  dispatcher.send(payload).then((res) => {
    console.log('send success: ', res);
  }).catch(console.error);
}, 1);
