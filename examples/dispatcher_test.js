'use strict';

const Dispatcher = require('./').Dispatcher;
const dispatcher = new Dispatcher();

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
