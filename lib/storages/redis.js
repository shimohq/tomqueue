'use strict';

class RedisStorage {
  constructor(options) {
    if (!options || !options.redis) {
      throw new Error('redis instance is required');
    }
    this.redis = options.redis;
  }

  shift(channel) {
    return this.redis.lpop(`tomqueue:channels:${channel}`).then((ret) => JSON.parse(ret));
  }

  push(channel, data) {
    return this.redis.rpush(`tomqueue:channels:${channel}`, JSON.stringify(data));
  }

  peek(channel) {
    return this.redis.lindex(`tomqueue:channels:${channel}`).then((ret) => JSON.parse(ret));
  }
}

module.exports = RedisStorage;
