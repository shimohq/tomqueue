'use strict';

const net = require('net');
const debug = require('debug')('leopard:dispatcher');
const utils = require('./utils');
const Server = require('./server');

const defaultOptions = {
  port: 7446,
  concurrencyPerChannel: Infinity
};

class Dispatcher extends Server {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, defaultOptions, this.options);

    this.channels = new Map();
    this.workers = new Map();
  }

  handleReply(reply, workerId) {
    const worker = this.workers.get(workerId);
    debug('got reply %j', reply);
    if (reply === 'PING') {
      if (worker) {
        worker.lastPing = new Date();
      }
      return;
    }
    reply = utils.packObject(reply);
    const taskList = this.channels.get(reply.channel);
    const task = taskList.shift();
    if (reply.error) {
      task.reject(reply.error);
    } else {
      task.resolve(reply);
    }

    if (!taskList.length) {
      this.channels.delete(reply.channel);
    }
    if (worker) {
      worker.pending -= 1;
    }
    this._dispatch(reply.channel);
  }

  send(payload) {
    const channel = payload.channel;
    if (!channel) {
      return Promise.reject('Missing "channel" property in payload');
    }
    debug('dispatching %j', payload);
    if (!this.channels.has(channel)) {
      this.channels.set(channel, []);
    }

    const taskList = this.channels.get(channel);

    return new Promise((resolve, reject) => {
      taskList.push({ payload, resolve, reject });
      this._dispatch(channel);
    });
  }

  start() {
    this.stream = net.createServer((client) => {
      client.id = `${client.address().host}:${client.address().port}`;
      const worker = {
        client,
        pending: 0,
        lastPing: new Date(),
        parser: this.createParser(client.id)
      };
      this.workers.set(client.id, worker);

      client.on('data', (data) => {
        worker.parser.execute(data);
      });

      client.on('close', () => {
        this.workers.delete(client.id);
      });
    });
    this.stream.on('listening', () => {
      this.setStatus('listening');
    });

    this.stream.listen(this.options.port);
  }

  _dispatch(channel) {
    const taskList = this.channels.get(channel);
    if (!taskList) {
      return;
    }

    // TODO: use skiplist for better performance
    const workers = Array.from(this.workers.values());
    const now = new Date();
    const healthyWorkers = workers.filter(worker => now - worker.lastPing < 2000);
    const candidates = healthyWorkers.length ? healthyWorkers : workers;

    let bestWorker;
    let minPendingCount = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].pending < minPendingCount) {
        minPendingCount = candidates[i].pending;
        bestWorker = candidates[i];
      }
    }

    debug('dispatch %s to %s worker %s', channel, healthyWorkers.length ? 'healthy' : '', bestWorker.id);
    bestWorker.client.write(utils.toPacket(utils.convertObjectToArray(taskList[0].payload)));
  }
}

module.exports = Dispatcher;
