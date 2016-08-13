'use strict';

const net = require('net');
const debug = require('debug')('leopard:dispatcher');
const utils = require('./utils');
const _ = require('lodash');
const Server = require('./server');
const storages = {
  memory: require('./storages/memory'),
  redis: require('./storages/redis')
};

const defaultOptions = {
  port: 7446,
  storage: 'memory'
};

class Dispatcher extends Server {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, defaultOptions, this.options);

    const Storage = storages[this.options.storage];
    if (!Storage) {
      throw new Error(`Unsupported storage "${this.options.storage}"`);
    }
    this.channels = new Storage();
    this.workers = {};
    this.healthyWorkers = {};
    this.offlineChannels = {};
  }

  processOfflineChannels() {
    let concurrency = 20;
    for (const key in this.offlineChannels) {
      if (!this.offlineChannels.hasOwnProperty(key)) {
        continue;
      }
      if (!concurrency) {
        return;
      }
      this._dispatch(key);
      concurrency -= 1;
      delete this.offlineChannels[key];
    }
    if (Object.keys(this.offlineChannels).length) {
      setTimeout(() => {
        this.processOfflineChannels();
      }, 100);
    }
  }

  handleReply(reply, workerId) {
    const worker = this.workers[workerId];
    debug('got reply %j', reply);
    if (reply === 'PING') {
      if (worker) {
        worker.lastPing = Date.now();
      }
      return;
    }
    reply = utils.packObject(reply);
    this.channels.shift(reply.channel).then((task) => {
      if (reply.error) {
        task.reject(reply.error);
      } else {
        task.resolve(reply);
      }

      if (worker) {
        worker.pending -= 1;
      }
      this._dispatch(reply.channel);
    });
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

    return new Promise((resolve, reject) => {
      this.channels.push(channel, { payload, resolve, reject }).then((length) => {
        if (length === 1) {
          this._dispatch(channel);
        }
      });
    });
  }

  start() {
    this.stream = net.createServer((client) => {
      client.id = `${client.address().host}:${client.address().port}`;
      const worker = {
        client,
        pending: 0,
        lastPing: Date.now(),
        parser: this.createParser(client.id)
      };
      this.workers[client.id] = worker;
      this.healthyWorkers[client.id] = worker;

      client.on('data', (data) => {
        worker.parser.execute(data);
      });

      client.on('close', () => {
        delete this.workers[client.id];
        delete this.healthyWorkers[client.id];
      });

      this.processOfflineChannels();
    });
    this.stream.on('listening', () => {
      this.setStatus('listening');
      this.refreshWorkers = setInterval(() => {
        const now = Date.now();
        for (const key in this.workers) {
          if (!this.workers.hasOwnProperty(key)) {
            continue;
          }
          if (now - this.workers[key].lastPing < 2000) {
            this.healthyWorkers[key] = this.workers[key];
          } else {
            delete this.healthyWorkers[key];
          }
        }
      }, 1000);
    });

    this.stream.listen(this.options.port);
  }

  stop() {
    if (this.refreshWorkers) {
      clearInterval(this.refreshWorkers);
      this.refreshWorkers = null;
    }
    if (this.stream) {
      this.stream.close();
    }
  }

  _dispatch(channel) {
    if (_.isEmpty(this.healthyWorkers)) {
      this.offlineChannels[channel] = true;
      return;
    }
    this.channels.retain(channel).then((data) => {
      if (data.status !== 'IDLE' || !data.task) {
        return;
      }

      const worker = _.minBy(_.values(this.healthyWorkers), 'pending');

      debug('dispatch %s to worker %s', channel, worker.id);
      worker.client.write(utils.toPacket(data.task.payload));
    }).catch((error) => {
      debug('failed to retain the channel %s because %s', channel, error);
    });
  }
}

module.exports = Dispatcher;
