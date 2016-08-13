'use strict';

class MemoryStorage {
  constructor() {
    this.data = {};
    this.retained = {};
  }

  shift(channel) {
    const list = this.data[channel];
    if (!list) {
      return Promise.resolve();
    }
    const ret = list.shift();
    if (!list.length) {
      delete this.data[channel];
    }
    delete this.retained[channel];
    return Promise.resolve(ret);
  }

  push(channel, data) {
    if (!this.data[channel]) {
      this.data[channel] = [];
    }
    this.data[channel].push(data);
    return Promise.resolve(this.data[channel].length);
  }

  retain(channel) {
    if (this.retained[channel]) {
      return Promise.resolve({ status: 'RETAINED' });
    }
    const ret = { status: 'IDLE' };
    this.retained[channel] = true;
    if (this.data[channel]) {
      ret.task = this.data[channel][0];
    }
    return Promise.resolve(ret);
  }

  release(channel) {
    delete this.retained[channel];
  }
}

module.exports = MemoryStorage;
