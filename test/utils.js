"use strict";

const _ = require('lodash');
require('should');

const vector = require('../dist/cjs/vector');
const utils = require('../dist/cjs/utils');

describe('utils', function () {
  describe('getFirstLastMinutes', function () {
    it('zero bitset should return undefined', function () {
      let bitset = vector.newBusyBitset(5);
      utils.getFirstLastMinutes(bitset, 5).should.have.properties({
        start: undefined,
        end: undefined
      });
    });
    it('full bitset should return first, last bits', function () {
      let bitset = vector.newFreeBitset(5);
      utils.getFirstLastMinutes(bitset, 5).should.have.properties({
        start: 0,
        end: 1440
      });
    });
    it('boundary test, last bits', function () {
      let bitset = [0, 0, 0, 0, 0, 32760, 31, 2147483648, 0];
      utils.getFirstLastMinutes(bitset, 5).should.have.properties({
        start: 885,
        end: 1125
      });
    });
    it('full bitset except first, last items', function () {
      let bitset = vector.newFreeBitset(5);
      bitset[0] = 0;
      bitset[8] = 0;
      utils.getFirstLastMinutes(bitset, 5).should.have.properties({
        start: 32 * 5,
        end: 1440 - 32 * 5
      });
    });
  });
  describe('_find1', function () {
    it('find first bit', function () {
      let p = {i: 0, b: 0};
      utils._find1(p, [utils.mask_left1[32]]).should.be.equal(0);
      p.i.should.be.equal(0);
      p.b.should.be.equal(0);
    });
    it('not find of 1 bit in zero(busy) bitset', function () {
      let p = {i: 0, b: 0};
      utils._find1(p, vector.busyBitSets[5]).should.be.equal(-1);
      p.i.should.be.equal(9);
      p.b.should.be.equal(0);
    });
    it('skip 3 left bits and find a bit on position 10', function () {
      let bitset = [utils.mask_left1[3] | 1 << (32 - 10)];
      let p = {i: 0, b: 3};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(0);
      p.b.should.be.equal(9);
    });
    it('check if will be 32th bit', function () {
      let bitset = [1];
      let p = {i: 0, b: 0};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(0);
      p.b.should.be.equal(31);
    });
    it('check move to next first left bit', function () {
      let bitset = [0, utils.mask_left1[1]];
      let p = {i: 0, b: 0};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(1);
      p.b.should.be.equal(0);
    });
    it('check move to next last bit', function () {
      let bitset = [0, 1];
      let p = {i: 0, b: 0};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(1);
      p.b.should.be.equal(31);
    });
    it('check move to next bit skip bits in next item', function () {
      let bitset = [0, utils.mask_left1[3] | 1 << (32 - 10)];
      let p = {i: 1, b: 9};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(1);
      p.b.should.be.equal(9);
    });
    it('check move over 2 items', function () {
      let bitset = [0, 0, 1];
      let p = {i: 0, b: 0};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(2);
      p.b.should.be.equal(31);
    });
    it('stay on the first bit', function () {
      let bitset = [(1 << 31) >>> 0];
      let p = {i: 0, b: 0};
      utils._find1(p, bitset).should.be.equal(0);
      p.i.should.be.equal(0);
      p.b.should.be.equal(0);
    });
    it('move out of bitset', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (1 << 31) >>> 0;
      let p = {i: 0, b: 1};
      utils._find1(p, bitset).should.be.equal(-1);
      p.i.should.be.equal(9);
      p.b.should.be.equal(0);
    });
  });
  describe('_findBack0', function () {
    it('0 bit in start position should return 0 offset', function() {
      let bitset = vector.newFreeBitset(5);
      bitset[0] = bitset[0] & (~(1 << 31)) >>> 0;
      let offset = utils._findBack0(bitset, {i:0, b:0}, 1);
      (offset).should.be.equal(0);
    });
    it('first 0 bit should return length of vector if search from end of vector - 1', function() {
      let bitset = vector.newFreeBitset(5);
      bitset[0] = bitset[0] & (~(1 << 31)) >>> 0;
      let offset = utils._findBack0(bitset, {i:8, b:31}, 288);
      (offset).should.be.equal(287);
    });
    it('first 0 bit and start {i:0, b:3} should return offset = 3', function() {
      let bitset = vector.newFreeBitset(5);
      bitset[0] = bitset[0] & (~(1 << 31)) >>> 0;
      let offset = utils._findBack0(bitset, {i:0, b:3}, 100);
      (offset).should.be.equal(3);
    });
  });
  describe('_fill1', function () {
    it('fill 0 bits', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 0, 0);
      bitset.join('').should.be.equal('0'.repeat(9));
    });
    it('fill 1 left bit', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 0, 1);
      bitset[0].should.be.equal((1 << 31) >>> 0);
    });
    it('skip 1 and fill 1 left bit', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 1, 1);
      bitset[0].should.be.equal((1 << 30) >>> 0);
    });
    it('fill last one bit', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 31, 1);
      bitset[0].should.be.equal(1);
    });
    it('fill whole 31 bits', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 0, 32);
      bitset[0].should.be.equal(0xffffffff);
    });
    it('move to 2nd item and fill 1st left bit', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 1, 0, 1);
      bitset[0].should.be.equal(0);
      bitset[1].should.be.equal((1 << 31) >>> 0);
    });
    it('fill whole 1st item and 1st left bit of 2nd item', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 0, 33);
      bitset[0].should.be.equal(0xffffffff);
      bitset[1].should.be.equal((1 << 31) >>> 0);
    });
    it('skip 3 bit and fill remained bits of 1st item', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 3, 32);
      bitset[0].should.be.equal(utils.mask_right1[32 - 3]);
      bitset[1].should.be.equal(utils.mask_left1[3]);
    });
    it('fill 3 items whole', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 0, 32 * 3);
      bitset[0].should.be.equal(0xffffffff);
      bitset[1].should.be.equal(0xffffffff);
      bitset[2].should.be.equal(0xffffffff);
    });
    it('skip 5 bits and fill 3 items', function () {
      let bitset = vector.newBusyBitset(5);
      utils._fill1(bitset, 0, 5, 32 * 3 - 10);
      bitset[0].should.be.equal(utils.mask_right1[32 - 5]);
      bitset[1].should.be.equal(0xffffffff);
      bitset[2].should.be.equal(utils.mask_left1[32 - 5]);
    });
  });
  describe('isSlotAvailable', function () {
    it('0 duration should not be available', function () {
      let bitset = vector.newBusyBitset(5);
      utils.isSlotAvailable(bitset, 0, 0, 5).should.be.equal(false);
    });
    it('zero bitset should not be available', function () {
      let bitset = vector.newBusyBitset(5);
      utils.isSlotAvailable(bitset, 0, 5, 5).should.be.equal(false);
    });
    it('first bit should be available if duration contains', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (1 << 31) >>> 0;
      utils.isSlotAvailable(bitset, 0, 5, 5).should.be.equal(true);
    });
    it('first bit should be not available if duration out of range', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (1 << 31) >>> 0;
      utils.isSlotAvailable(bitset, 0, 6, 5).should.be.equal(false);
    });
    
    it('several bits should be available if duration contains', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (utils.mask_left1[10] & ~utils.mask_left1[5]) >>> 1;
      utils.isSlotAvailable(bitset, 30, 45, 5).should.be.equal(true);
    });
    it('several bits throw int32 bounds should be available if duration contains', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = utils.mask_right1[2];
      bitset[1] = utils.mask_left1[3];
      utils.isSlotAvailable(bitset, 150, 175, 5).should.be.equal(true);
      utils.isSlotAvailable(bitset, 150, 180, 5).should.be.equal(false);
    });
    it('find last bits', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[8] = utils.mask_right1[3];
      utils.isSlotAvailable(bitset, 1440 - 15, 1440, 5).should.be.equal(true);
      utils.isSlotAvailable(bitset, 1440 - 20, 1440, 5).should.be.equal(false);
    });
  });
  describe('buildBookingCRACVector', function () {
    it('build from zero bitset should be zero array', function() {
      let bitset = vector.newBusyBitset(5);
      let result = utils.buildBookingCRACVector(bitset, 0, 1, 5);
      for (let i = 0; i < 9; ++i) {
        result[i].should.be.equal(0);
      }
    });
    it('first bit with 1 slot size should return first bit', function() {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (1 << 31)>>>0;
      let result = utils.buildBookingCRACVector(bitset, 0, 1, 5);
      result[0].should.be.equal((1 << 31)>>>0);
    });
    it('first 2 bits with 2 slot size should return first bit', function() {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = utils.mask_left1[2];
      let result = utils.buildBookingCRACVector(bitset, 0, 2, 5);
      result[0].should.be.equal((1 << 31)>>>0);
    });
    it('skip 10 bits and find 10 bits sz=10 should return 9 bits from 11 position', function() {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (utils.mask_left1[20] & ~utils.mask_left1[10]);
      let result = utils.buildBookingCRACVector(bitset, 0, 2, 5);
      result[0].should.be.equal(utils.mask_left1[19] & ~utils.mask_left1[10]);
    });
    it('sz more when number of bits', function() {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (utils.mask_left1[20] & ~utils.mask_left1[10]);
      let result = utils.buildBookingCRACVector(bitset, 0, 11, 5);
      result[0].should.be.equal(0);
    });
    it('sz exactly same number of bits', function() {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (utils.mask_left1[20] & ~utils.mask_left1[10]);
      let result = utils.buildBookingCRACVector(bitset, 0, 10, 5);
      result[0].should.be.equal(utils.mask_left1[11] & ~utils.mask_left1[10]);
    });
    it('zero vector should return zero vector', function () {
      let bitset = vector.newBusyBitset(5);
      let result = utils.buildBookingCRACVector(bitset, 0, 10, 5);
      for (let i = 0; i < bitset.length; ++i) {
        result[i].should.be.equal(0);
      }
    });
    it('full free vector should return free vector except last sz-1 bits', function () {
      const sz = 10;
      let bitset = vector.newFreeBitset(5);
      let result = utils.buildBookingCRACVector(bitset, 0, sz, 5);
      for (let i = 0; i < bitset.length - 1; ++i) {
        result[i].should.be.equal(0xffffffff);
      }
      result[8].should.be.equal((~utils.mask_right1[sz - 1]) >>> 0);
    });
  });
  describe('_vectorLeftShift', function () {
    it('zero shift should return the same vector', function () {
      let bitset = new Array(3);
      bitset[0] = (1 << 10) >>> 0;
      bitset[1] = (1 << 12) >>> 0;
      bitset[2] = (1 << 7) >>> 0;
      let result = utils._vectorLeftShift(bitset.slice(), 0);
      result[0].should.be.equal(bitset[0]);
      result[1].should.be.equal(bitset[1]);
      result[2].should.be.equal(bitset[2]);
    });
    it('2nd bit should be 1st after shift', function () {
      let bitset = new Array(1);
      bitset[0] = (1 << 30) >>> 0;
      let result = utils._vectorLeftShift(bitset.slice(), 1);
      result[0].should.be.equal((1 << 31) >>> 0);
    });
    it('shift over 32', function () {
      let bitset = new Array(3);
      bitset[0] = (1 << 29) >>> 0;
      bitset[1] = (1 << 29) >>> 0;
      bitset[2] = (1 << 29) >>> 0;
      let result = utils._vectorLeftShift(bitset.slice(), 33);
      result[0].should.be.equal((1 << 30) >>> 0);
      result[1].should.be.equal((1 << 30) >>> 0);
      result[2].should.be.equal(0);
    });
    it('move whole bits from 2nd item and save bits in 1st', function () {
      let bitset = new Array(2);
      bitset[0] = utils.mask_right1[2];
      bitset[1] = utils.mask_left1[28];
      let result = utils._vectorLeftShift(bitset.slice(), 30);
      result[0].should.be.equal(utils.mask_left1[30]);
      result[1].should.be.equal(0);
    });
  });
  describe('buildSequenceBookingCRACVector', function () {
    it('one bitset with same duration should return same vector', function () {
      let bitset = vector.newBusyBitset(5);
      bitset[0] = (1 << 10) >>> 0;
      bitset[1] = (1 << 12) >>> 0;
      bitset[2] = (1 << 7) >>> 0;
      let result = utils.buildSequenceBookingCRACVector([bitset], [5], 5);
      result[0].should.be.equal(bitset[0]);
      result[1].should.be.equal(bitset[1]);
      result[2].should.be.equal(bitset[2]);
    });
    it('3 bitsets with 1 sequence bits durations=1 should return same vector with first bit', function () {
      let bitsets = [
        vector.newBusyBitset(5),
        vector.newBusyBitset(5),
        vector.newBusyBitset(5)
      ];
      bitsets[0][0] = (1 << 31) >>> 0;
      bitsets[1][0] = (1 << 30) >>> 0;
      bitsets[2][0] = (1 << 29) >>> 0;
      let result = utils.buildSequenceBookingCRACVector(bitsets, [5, 5, 5], 5);
      result[0].should.be.equal((1 << 31) >>> 0);
    });
    it('3 bitsets with different durations should return vector with first bit', function () {
      let bitsets = [
        vector.newBusyBitset(5),
        vector.newBusyBitset(5),
        vector.newBusyBitset(5)
      ];
      bitsets[0][0] = utils.mask_left1[1];
      bitsets[1][0] = utils.mask_left1[2] >>> 1;
      bitsets[2][0] = utils.mask_left1[3] >>> 3;
      let result = utils.buildSequenceBookingCRACVector(bitsets, [5, 10, 15], 5);
      result[0].should.be.equal(utils.mask_left1[1]);
    });
    it('3 bitsets with break BETWEEN bitsets', function () {
      let bitsets = [
        vector.newBusyBitset(5),
        vector.newBusyBitset(5),
        vector.newBusyBitset(5)
      ];
      bitsets[0][0] = utils.mask_left1[1];
      bitsets[1][0] = utils.mask_left1[2] >>> 1;
      bitsets[2][0] = utils.mask_left1[3] >>> 4;
      let result = utils.buildSequenceBookingCRACVector(bitsets, [5, 10, 15], 5);
      result[0].should.be.equal(0);
    });
    it('2 bitset overlay 1st over 2nd', function () {
      let bitsets = [
        vector.newBusyBitset(5),
        vector.newBusyBitset(5)
      ];
      utils._fill1(bitsets[0], 0, 0, 30);
      utils._fill1(bitsets[1], 0, 10, 20);
      let result = utils.buildSequenceBookingCRACVector(bitsets, [50, 100], 5);
      result[0].should.be.equal(utils.mask_left1[20]);
    });
    it('3 bitsets with out of int32', function () {
      let bitsets = [
        vector.newBusyBitset(5),
        vector.newBusyBitset(5),
        vector.newBusyBitset(5)
      ];
      utils._fill1(bitsets[0], 0, 0, 10);
      utils._fill1(bitsets[1], 0, 10, 20);
      utils._fill1(bitsets[2], 0, 30, 30);
      let result = utils.buildSequenceBookingCRACVector(bitsets, [50, 100, 150], 5);
      result[0].should.be.equal(utils.mask_left1[10]);
    });
    it('3 bitsets with break in first', function () {
      let bitsets = [
        vector.newBusyBitset(5),
        vector.newBusyBitset(5),
        vector.newBusyBitset(5)
      ];
      
      bitsets[0][0] = (utils.mask_left1[10] & ~(1 << 23)) >>> 0;
      utils._fill1(bitsets[1], 0, 10, 20);
      utils._fill1(bitsets[2], 0, 30, 30);
      let result = utils.buildSequenceBookingCRACVector(bitsets, [50, 100, 150], 5);
      result[0].should.be.equal(bitsets[0][0]);
    });
  });
});