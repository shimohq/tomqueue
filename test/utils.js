'use strict';

const utils = require('../lib/utils');
const expect = require('chai').expect;

describe('utils', function () {
  describe('.toPacket()', function () {
    it('returns correct results', function () {
      expect(utils.toPacket('name')).to.eql('$4\r\nname\r\n');
      expect(utils.toPacket({ a: { b: undefined } })).to.eql('*2\r\n$1\r\na\r\n$-1\r\n');
      expect(utils.toPacket({ a: { b: 'c' } })).to.eql('*2\r\n$1\r\na\r\n*2\r\n$1\r\nb\r\n$1\r\nc\r\n');
    });
  });
});
