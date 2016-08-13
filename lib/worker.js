'use strict';

const net = require('net');
const debug = require('debug')('leopard:worker');
const utils = require('./utils');
const Server = require('./server');

const defaultOptions = {
  dispatcherPort: 7446,
  dispatcherHost: 'localhost',
  concurrencyPerChannel: Infinity,
  retryStrategy() {
    return 500;
  }
};

class Worker extends Server {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, defaultOptions, this.options);
    this.pending = 0;
  }

  handleReply(reply) {
    const payload = utils.packObject(reply);
    this.pending += 1;
    this.options.handler(payload)
    .then((result) => {
      this.reply(Object.assign(result, { channel: payload.channel }));
    })
    .catch((error) => {
      this.reply({ error, channel: payload.channel });
    })
    .then(() => {
      this.pending -= 1;
      if (!this.pending) {
        this.emit('drain');
      }
    });
  }

  handleFatalError(fatalError) {
    console.error('Fatal error received:', fatalError);

    if (this.stream) {
      this.stream.end();
    }
  }

  reply(result) {
    this.stream.write(utils.toPacket(result));
  }

  start() {
    const stream = net.createConnection({
      port: this.options.dispatcherPort,
      host: this.options.dispatcherHost
    });
    stream.setKeepAlive(true);

    let parser;
    stream.once('connect', () => {
      this.setStatus('connect');
      parser = this.createParser();
      this.pingInterval = setInterval(() => {
        this.stream.write(utils.toPacket('PING'));
      }, 1000);
    });

    stream.once('error', (error) => {
      debug('error: %s', error);
      this.silentEmit('error', error);
    });

    stream.once('close', () => {
      this.setStatus('close');
      clearInterval(this.pingInterval);

      if (this.manuallyClosing) {
        this.manuallyClosing = false;
        debug('skip reconnecting since the connection is manually closed.');
        this.setStatus('end');
        return;
      }

      if (typeof this.options.retryStrategy !== 'function') {
        debug('skip reconnecting because `retryStrategy` is not a function');
        this.setStatus('end');
        return;
      }

      const retryDelay = this.options.retryStrategy(++this.retryAttempts);
      if (typeof retryDelay !== 'number') {
        debug('skip reconnecting because `retryStrategy` doesn\'t return a number');
        this.setStatus('end');
        return;
      }

      debug('reconnect in %sms', retryDelay);

      this.setStatus('reconnecting', retryDelay);
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.start();
      }, retryDelay);
    });

    stream.once('data', (data) => {
      parser.execute(data);
    });

    if (this.options.connectTimeout) {
      stream.setTimeout(this.options.connectTimeout, () => {
        stream.setTimeout(0);
        stream.destroy();

        const error = (Object.assign(new Error('connect ETIMEDOUT'), {
          errorno: 'ETIMEDOUT',
          code: 'ETIMEDOUT',
          syscall: 'connect'
        }));
        debug('error: %s', error);
        this.silentEmit('error', error);
      });

      stream.once('connect', function () {
        stream.setTimeout(0);
      });
    }

    this.stream = stream;
  }

  stop() {
    this.manuallyClosing = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.stream) {
      this.stream.end();
    }
  }
}

module.exports = Worker;
