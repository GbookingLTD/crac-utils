"use strict";

var _ = require('lodash');
require('should');

var vector = require('../dist/cjs/vector');
var utils = require('../dist/cjs/utils');

var cracVectorOrder = 'reverse';

function reverseString(str) {
    var newString = "";
    for (var i = str.length - 1; i >= 0; i--) {
        newString += str[i];
    }
    return newString;
}

function stringCracVector(str, cracVectorSize) {
  cracVectorSize = cracVectorSize || 288;
  // string alignment
  if (str.length < cracVectorSize) {
    str += '0'.repeat(cracVectorSize - str.length);
  }
  if (cracVectorOrder === 'reverse') {
    str = reverseString(str);
  }
  return str;
}

describe('vector', function() {
  describe('#bitsetStrToInt32Array', function() {
    it('100 of "0" string is zero bitset', function() {
      var s = stringCracVector('0'.repeat(100));
      var bs = vector.bitsetStrToInt32Array(s);
      bs.should.be.instanceof(Array);
      for (var i = 0; i < bs.length; i++) {
        bs[i].should.be.equal(0);
      }
    });
    it('"1000..." string should generate 1 bit bitset', function() {
      var s = stringCracVector("1" + '0'.repeat(31));
      var bs = vector.bitsetStrToInt32Array(s);
      (bs[0]).should.be.equal((1<<31) >>> 0);
    });
    it('3rd bit string should generate 3rd bit bitset', function() {
      var s = stringCracVector('0'.repeat(3) + "1");
      var bs = vector.bitsetStrToInt32Array(s);
      (bs[0]).should.be.equal(1<<(31-3));
    });
    it('64th bit string should generate last bit in 2nd byte in bitset', function() {
      var s = stringCracVector('0'.repeat(63) + "1");
      var bs = vector.bitsetStrToInt32Array(s);
      (bs[1]).should.be.equal(1);
    });
    it('change time unit to 1', function() {
      var s = stringCracVector('0'.repeat(63) + "1", 1440);
      var bs = vector.bitsetStrToInt32Array(s, 1);
      bs.should.be.instanceof(Array).and.have.lengthOf(45);
      (bs[1]).should.be.equal(1);
    });
  });
  describe('#getCRACFreeSlots', function() {
    it('zero crac-vector should generate empty slots', function() {
      var s = stringCracVector('');
      var bs = vector.bitsetStrToInt32Array(s);
      var slots = vector.getCRACFreeSlots(bs, 30);
      slots.should.be.instanceof(Array).and.have.lengthOf(0);
    });
    it('crac-vector starts with "1" should generate 1 slot with offset 0', function() {
      var s = stringCracVector('1');
      var bs = vector.bitsetStrToInt32Array(s);
      var slots = vector.getCRACFreeSlots(bs, 1);
      slots.should.be.instanceof(Array).and.have.lengthOf(1);
      slots[0].should.be.equal(0);
    });
    it('crac-vector starts with (540 / 5) "1" should have first free slot at 9:00', function() {
      var s = stringCracVector('0'.repeat(540 / 5) + '1');
      var bs = vector.bitsetStrToInt32Array(s);
      var slots = vector.getCRACFreeSlots(bs, 1);
      slots.should.be.instanceof(Array).and.have.lengthOf(1);
      slots[0].should.be.equal(540 / 5);
    });
    it('crac-vector starts with (540 / 5) "1" (12 items) should have 2 slots - 9:00, 9:30', function() {
      var s = stringCracVector('0'.repeat(540 / 5) + '1'.repeat(60 / 5));
      var bs = vector.bitsetStrToInt32Array(s);
      var slots = vector.getCRACFreeSlots(bs, 6);
      slots.should.be.instanceof(Array).and.have.lengthOf(2);
      slots[0].should.be.equal(540 / 5);
      slots[1].should.be.equal(570 / 5);
    });
    it('crac-vector starts with (540 / 5) "1" (12 items) should except 9:00 slot if startOffset=9:30', function() {
      var s = stringCracVector('0'.repeat(540 / 5) + '1'.repeat(60 / 5));
      var bs = vector.bitsetStrToInt32Array(s);
      var slots = vector.getCRACFreeSlots(bs, 6, 570 / 5);
      slots.should.be.instanceof(Array).and.have.lengthOf(1);
      slots[0].should.be.equal(570 / 5);
    });
    it('crac-vector with 64 of "1" should have (64 * 5 / 30) = 10 slots by 30 minutes', function() {
      var s = stringCracVector('1'.repeat(64));
      var bs = vector.bitsetStrToInt32Array(s);
      var slots = vector.getCRACFreeSlots(bs, 6);
      slots.should.be.instanceof(Array).and.have.lengthOf(10);
      for (var i = 0; i < 10; i++) {
        slots[i].should.be.equal(i * 6);
      }
    });
    it('crac-vector (timeUnit=1) with 64 of "1" should have (64 / 30) = 2 slots by 30 minutes', function() {
      var s = stringCracVector('1'.repeat(64), 1440);
      var bs = vector.bitsetStrToInt32Array(s, 1);
      var slots = vector.getCRACFreeSlots(bs, 30);
      slots.should.be.instanceof(Array).and.have.lengthOf(2);
      slots[0].should.be.equal(0);
      slots[1].should.be.equal(30);
    });
  });
  describe('#calculateWorkloadWeights', function() {
    it('zero crac-vector has 0 weight', function() {
      var weights = utils.calculateWorkloadWeights([{
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('')
        }]
      }]);
      _.find(weights, {resourceId: 'a'}).weight.should.be.equal(0);
    });
    it('100 bits crac-vector has 100 weight', function() {
      var weights = utils.calculateWorkloadWeights([{
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('1'.repeat(100))
        }]
      }]);
      _.find(weights, {resourceId: 'a'}).weight.should.be.equal(100);
    });
    it('2 bitsets in one day but differ resources should not be joint', function() {
      var weights = utils.calculateWorkloadWeights([{
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('1'.repeat(50))
        }, {
          resourceId: 'b',
          bitset: stringCracVector('1'.repeat(50))
        }]
      }]);
      _.find(weights, {resourceId: 'a'}).weight.should.be.equal(50);
    });
    it('2 bitsets in differ days should be joint', function() {
      var weights = utils.calculateWorkloadWeights([{
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('1'.repeat(50))
        }]
      }, {
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('1'.repeat(50))
        }]
      }]);
      _.find(weights, {resourceId: 'a'}).weight.should.be.equal(100);
    });
    it('2 differ days should return not empty day', function() {
      var weights = utils.calculateWorkloadWeights([{
        date: "2017-09-03 07:19:32.726Z",
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('1'.repeat(50))
        }]
      }, {
        date: "2017-09-04 07:19:32.726Z",
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('')
        }]
      }]);
      _.find(weights, {resourceId: 'a'}).firstSlotDate.should.be.equal('2017-09-03 07:19:32.726Z');
    });
    it('zero vector should return 0 startMinutes', function() {
      var slotSize = 5;
      var weights = utils.calculateWorkloadWeights([{
        date: "2018-06-28T00:00:00Z",
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('0'.repeat(288), slotSize)
        }]
      },], slotSize);
      _.find(weights, {resourceId: 'a'}).firstSlotStartMinutes
        .should.be.equal(0);
    });
    it('vector with start 1 bit should return 5 startMinutes', function() {
      var slotSize = 5;
      var weights = utils.calculateWorkloadWeights([{
        date: "2018-06-28T00:00:00Z",
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('1' + '0'.repeat(287), slotSize)
        }]
      },], slotSize);
      _.find(weights, {resourceId: 'a'}).firstSlotStartMinutes
        .should.be.equal(5);
    });
    it('vector with last 1 bit should return (numOfBits * slotSize) startMinutes', function() {
      var slotSize = 5;
      var weights = utils.calculateWorkloadWeights([{
        date: "2018-06-28T00:00:00Z",
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('0'.repeat(287) + '1', slotSize)
        }]
      },], slotSize);
      _.find(weights, {resourceId: 'a'}).firstSlotStartMinutes
        .should.be.equal(1440);
    });
    it('vector with 7th 1 bit should return 7 * startMinutes', function() {
      var slotSize = 5;
      var weights = utils.calculateWorkloadWeights([{
        date: "2018-06-28T00:00:00Z",
        resources:[{
          resourceId: 'a',
          bitset: stringCracVector('0'.repeat(6) + '1' + '0'.repeat(281), slotSize)
        }]
      },], slotSize);
      _.find(weights, {resourceId: 'a'}).firstSlotStartMinutes
        .should.be.equal(7 * slotSize);
    });
    it('when in 1st day zero vector and next day filled vector', function() {
      var slotSize = 1;
      var weights = utils.calculateWorkloadWeights([{
        date: "2018-06-28T00:00:00Z",
        resources:[{
            "resourceId": "582574ff7d9605345fcdbccf",
            "bitset": "00000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.",
        }]
      },{
        date: "2018-06-29T00:00:00Z",
        resources:[{
            "resourceId": "582574ff7d9605345fcdbccf",
            "bitset": "10000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.0000000000000000000000000000000000000000000000000000000000000000.",
        }]
      }], slotSize);
      _.find(weights, {resourceId: '582574ff7d9605345fcdbccf'}).firstSlotDate
        .should.be.equal('2018-06-29T00:00:00Z');
      _.find(weights, {resourceId: '582574ff7d9605345fcdbccf'}).firstSlotStartMinutes
        .should.be.equal(1440);
    });
  })
});