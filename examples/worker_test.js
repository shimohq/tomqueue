'use strict';

const Worker = require('./').Worker;

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
