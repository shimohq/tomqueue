'use strict';

const Redis = require('ioredis');
const Dispatcher = require('../').Dispatcher;
const dispatcher = new Dispatcher({
  storage: 'redis',
  storageOptions: {
    redis: new Redis()
  }
});

dispatcher.start();

let rev = 1;
setInterval(function () {
  const payload = {
    channel: 'abc' + rev,
    rev: rev++
  };
  dispatcher.send(payload).then((res) => {
    console.log(res);
  }).catch(console.error);
}, 500);
