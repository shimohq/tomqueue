'use strict';

/**
 * Convert an object to an array
 *
 * @param {object} obj
 * @return {array}
 * @example
 * ```js
 * > convertObjectToArray({ a: '1' })
 * ['a', '1']
 * ```
 */
function convertObjectToArray(obj) {
  const result = [];
  let pos = 0;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[pos] = key;
      result[pos + 1] = obj[key];
    }
    pos += 2;
  }
  return result;
}

/**
 * Pack an array to an Object
 *
 * @param {array} array
 * @return {object}
 * @example
 * ```js
 * > packObject(['a', 'b', 'c', 'd'])
 * { a: 'b', c: 'd' }
 * ```
 */
exports.packObject = function (array) {
  const result = {};
  const length = array.length;

  for (let i = 1; i < length; i += 2) {
    result[array[i - 1]] = array[i];
  }

  return result;
};

exports.toPacket = function (data) {
  if (typeof data === 'undefined') {
    return '';
  }

  if (data instanceof Error) {
    return '-' + data.message + '\r\n';
  }
  if (typeof data === 'number') {
    return ':' + data + '\r\n';
  }
  if (data === null) {
    return '$-1\r\n';
  }
  if (typeof data === 'object') {
    if (!Array.isArray(data)) {
      data = convertObjectToArray(data);
    }
    let result = '*' + data.length + '\r\n';
    data.forEach((item) => {
      result += exports.toPacket(item);
    });
    return result;
  }

  data = data.toString();
  return '$' + data.length + '\r\n' + data + '\r\n';
};
