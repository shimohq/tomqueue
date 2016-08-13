'use strict';

const debug = require('debug')('tomqueue:status');
const Parser = require('redis-parser');
const EventEmitter = require('events').EventEmitter;

class Server extends EventEmitter {
  constructor(options) {
    super();
    this.name = 'server';
    this.options = options || {};
  }

  createParser(id) {
    return new Parser({
      returnReply: (reply) => {
        this.handleReply(reply, id);
      },
      returnError: (error) => {
        this.handleReply(error, id);
      },
      returnFatalError: (fatalError) => {
        this.handleFatalError(fatalError, id);
      }
    });
  }

  handleReply(reply) {
    console.log('Unhandled reply', reply);
  }

  handleFatalError(fatalError) {
    console.log('Unhandled fatal error', fatalError);
  }

  setStatus(status, arg) {
    debug('status[%s]: %s -> %s', this.name, this.status || '[empty]', status);
    this.status = status;
    process.nextTick(this.emit.bind(this, status, arg));
  }

  silentEmit(eventName) {
    if (this.listeners(eventName).length > 0) {
      return this.emit.apply(this, arguments);
    }

    let error;
    if (eventName === 'error') {
      error = arguments[1];
    }
    if (error && error instanceof Error) {
      console.error('Unhandled error event:', error.stack);
    }
    return false;
  }
}

module.exports = Server;
