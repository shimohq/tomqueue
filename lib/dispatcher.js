'use strict';

const net = require('net');
const debug = require('debug')('tomqueue:dispatcher');
const uuid = require('uuid');
const utils = require('./utils');
const _ = require('lodash');
const Server = require('./server');
const storages = {
  memory: require('./storages/memory'),
  redis: require('./storages/redis')
};

const env = process.env.NODE_ENV;

const defaultOptions = {
  port: 7446,
  storage: 'memory'
};

// default send msg timeout (ms)
const DEFAULT_SEND_TIMEOUT = 5000; 

const warning = 'Warning: tomqueue MemoryStorage is not\n'
  + 'designed for a production environment, as it will leak\n'
  + 'memory, and will not scale past a single process.';

class Dispatcher extends Server {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, defaultOptions, this.options);

    if (env === 'production' && this.options.storage === 'memory') {
      console.warn(warning);
    }

    const Storage = storages[this.options.storage];
    if (!Storage) {
      throw new Error(`Unsupported storage "${this.options.storage}"`);
    }
    this.channels = new Storage(this.options.storageOptions);
    this.workers = {};
    this.healthyWorkers = {};
    this.clientId = 1;

    this.setMaxListeners(Number.MAX_VALUE);
  }

  handleReply(reply, workerId) {
    const worker = workerId && this.workers[workerId];
    if (reply === 'PING') {
      if (worker) {
        debug('got ping from worker %s', worker.id);
        worker.lastPing = Date.now();
      }
      return;
    }
    debug('got reply %j', reply);
    reply = utils.packObject(reply);
    this.channels.shift(reply.channel).then((task) => {
      debug('shift :', reply.channel);
      if (reply.error) {
        task && task.tId && this.emit('ack_err_' + task.tId, reply.error);
      } else {
        task && task.tId && this.emit('ack_' + task.tId, reply);
      }

      if (worker) {
        delete worker.channels[reply.channel];
        worker.pending -= 1;
      }
      this._dispatch(reply.channel);
    });
  }

  send(payload) {
    const _this = this;
    const channel = payload.channel;
    if (!channel) {
      return Promise.reject('Missing "channel" property in payload');
    }
    return new Promise((resolve, reject) => {
      // Create a transaction id for marking this transaction.
      const tId = uuid.v4();

      this.channels.push(channel, { payload, tId }).then((length) => {
        if (length === 1) {
          this._dispatch(channel);
        }

        function handleSendSuccess(data) {
          cleanListeners(this.tId);
          return resolve(data);
        }

        function handleSendFail(err) {
          cleanListeners(this.tId);
          return reject(err);
        }

        function cleanListeners(tId) {
          _this.removeListener('ack_' + tId, handleSendSuccess);
          _this.removeListener('ack_err_' + tId, handleSendFail);
        }

        // handle success and fail event
        this.on('ack_' + tId, handleSendSuccess.bind({ tId }));
        this.on('ack_err_' + tId, handleSendFail.bind({ tId }));

        // TODO: remove listener when touching timeout if needed
        // setTimeout(() => {
        //   debug('[clean hanndler] transaction => %s', tId);
        //   this.removeListener('ack_' + tId, handleSendSuccess);
        //   this.removeListener('ack_err_' + tId, handleSendFail);
        // }, DEFAULT_SEND_TIMEOUT);
      });
    });
  }

  start() {
    this.stream = net.createServer((client) => {
      const id = `worker${this.clientId++}`;
      const worker = {
        client,
        id,
        pending: 0,
        lastPing: Date.now(),
        parser: this.createParser(id),
        channels: {}
      };
      this.workers[id] = worker;
      this.healthyWorkers[id] = worker;
      debug('[join] %s', id);

      client.on('data', (data) => {
        worker.parser.execute(data);
      });

      client.on('error', () => {
        this._removeWorker(id, worker.channels);
        debug('[error] %s', id);
      });

      client.on('close', () => {
        this._removeWorker(id, worker.channels);
        debug('[leave] %s', id);
      });

    });
    this.stream.on('listening', () => {
      this.setStatus('listening');
      this.refreshWorkers = setInterval(() => {
        const now = Date.now();
        for (const key in this.workers) {
          if (!this.workers.hasOwnProperty(key)) {
            continue;
          }
          if (now - this.workers[key].lastPing < 5000) {
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

  /**
   * remove invaliable worker and requeue payload from
   * the worker
   */
  _removeWorker(id, channelsObj) {
    delete this.workers[id];
    delete this.healthyWorkers[id];
    Object.keys(channelsObj).forEach((channel) => {
      // TODO: uncomment the following code if worker is mutable
      // this.handleReply(utils.convertObjectToArray({
      //   channel, error: new Error('Client is closed')
      // }));
      // return;
      this._dispatch(channel);
    });
  }

  _dispatch(channel) {
    this.channels.peek(channel).then((task) => {
      if (!task) {
        return;
      }

      let candidates = _.values(this.healthyWorkers);
      if (!candidates.length) {
        candidates = _.values(this.workers);
      }
      const worker = _.minBy(candidates, 'pending');

      if (worker) {
        worker.pending += 1;
        debug('dispatch %s to worker %s', channel, worker.id);
        worker.channels[channel] = true;
        worker.client.write(utils.toPacket(task.payload));
      } else {
        this.handleReply(utils.convertObjectToArray({ channel, error: new Error('No available worker') }));
      }
    }).catch((error) => {
      debug('failed to retain the channel %s because %s', channel, error);
      this.handleReply(utils.convertObjectToArray({ channel, error }));
    });
  }
}

module.exports = Dispatcher;
