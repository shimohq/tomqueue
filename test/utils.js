'use strict';

const utils = require('../lib/utils');
const expect = require('chai').expect;
const Parser = require('redis-parser');

describe('utils', function () {
  describe('.toPacket()', function () {
    it('returns correct results', function () {
      testIO({ a: { b: undefined } }, ['a', [] ], '*2\r\n$1\r\na\r\n*0\r\n');
      testIO({ a: { b: 'c' } }, ['a', ['b', 'c']], '*2\r\n$1\r\na\r\n*2\r\n$1\r\nb\r\n$1\r\nc\r\n');
      testIO({ a: { b: '我' } }, ['a', ['b', '我']], '*2\r\n$1\r\na\r\n*2\r\n$1\r\nb\r\n$3\r\n我\r\n');
      testIO('name', 'name', '$4\r\nname\r\n');
    });
  });
});

function testIO(input, output, middleState) {
  const packet = utils.toPacket(input);
  expect(packet).to.eql(middleState);
  const parser = new Parser({
    returnReply: (reply) => {
      send(reply);
    },
    returnError: (error) => {
      send(error);
    },
    returnFatalError: (fatalError) => {
      send(fatalError);
    }
  });

  function send(reply) {
    expect(output).to.eql(reply);
  }

  parser.execute(new Buffer(packet));
}
