'use strict';

class MemoryStorage {
  constructor() {
    this.data = {};
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
    return Promise.resolve(ret);
  }

  push(channel, data) {
    if (!this.data[channel]) {
      this.data[channel] = [];
    }
    this.data[channel].push(data);
    return Promise.resolve(this.data[channel].length);
  }

  peek(channel) {
    if (!this.data[channel]) {
      return Promise.resolve();
    }
    return Promise.resolve(this.data[channel][0]);
  }
}

module.exports = MemoryStorage;
