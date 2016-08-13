'use strict';

const Dispatcher = require('../').Dispatcher;
const dispatcher = new Dispatcher();

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
}, 10);
