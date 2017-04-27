'use strict';

const Worker = require('../').Worker;

const worker = new Worker({
  handler(payload) {
    return processChangeset(payload);
  }
});

worker.start();

const queue = [];

function processChangeset(data) {
  return new Promise((resolve, reject) => {
    queue.push({ resolve, data });
  });
}

setInterval(() => {
  const task = queue.shift();
  if (task) {
    task.resolve(task.data);
  }
}, 200);
