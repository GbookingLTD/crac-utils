"use strict";

var _ = require('lodash');

var cracTimeUnit = 5;

var bitsetStrToInt32Array = function (s) {
  if (s.length !== 288) throw Error('string bitset should contain 288 chars');
  s = s.replace(/\./g, '');
  var bi, bs = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (var i = s.length - 1; i >= 0; i--) {
    // i  - char index: from 287 to 0
    // bi - byte index: from 0 to 8
    bi = (287 - i) >> 5;
    bs[bi] = bs[bi] << 1 | (s[i] === "1");
  }
  return bs;
};

var _iterateCRACVector = function (offset, bitset, fn) {
  for (var bi = offset >> 5; bi < bitset.length; bi++) {
    // bi - byte index: from 0 or more to 8
    while (true) {
      // move 1 bit in mask from right to left
      // offset = 0; mask = 1 << 31
      // offset = 1; mask = 1 << 30
      // ...
      // offset = 31; mask = 1 << 0
      var mask = 1 << (31 - offset) % 32;
      var bit = bitset[bi] & mask;
      fn(bit, offset);
      if (++offset % 32 === 0) break;
    }
  }
};

var getCRACFreeSlots = function (cracCellOffset, bitset, slotCells) {
  var freeSlots = [];
  var lenCurSlot = 0;
  var offsetCurSlot = -1;
  var fn = function (bit, offset) {
    if (offsetCurSlot < 0) {
      // found first slot bit
      if (bit) {
        offsetCurSlot = offset;
        lenCurSlot = 1;
      }
    } else {
      // continue crac slot reading
      if (bit === 0) {
        lenCurSlot = 0;
        offsetCurSlot = -1;
      } else {
        ++lenCurSlot;
      }
    }
    
    if (offsetCurSlot >= 0 && lenCurSlot >= slotCells) {
      freeSlots.push(offsetCurSlot);
      lenCurSlot = 0;
      offsetCurSlot = -1;
    }
  };

  _iterateCRACVector(cracCellOffset, bitset, fn);
  return freeSlots;
};

function _makeSlots(startOffset, date, bitset, duration, resId, taxId) {
  var freeSlots = getCRACFreeSlots(Math.floor(startOffset / cracTimeUnit), bitset, Math.floor(30 / cracTimeUnit));
  var d = new Date(Date.parse(date));
  return freeSlots.map(function (cracOffset) {
    var offsetMinutes = cracOffset * cracTimeUnit;
    var curD = new Date(d);
    curD.setUTCMinutes(offsetMinutes);
    return {
      resourceId: resId,
      taxonomyId: taxId,
      start: curD.toUTCString(),
      duration: duration
    };
  });
}

var makeSlots = function (startOffset, slots, taxonomyId, duration) {
  return _.reduce(slots, function (ret, day) {
    var resourses = day.resources;
    if (day.excludedResources) {
      resourses = resourses.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resourses.forEach(function (r) {
      var bs = (typeof r.bitset === "string") ? bitsetStrToInt32Array(r.bitset) : r.bitset;
      ret = ret.concat(_makeSlots(startOffset, day.date, bs, duration, r.resourceId, taxonomyId));
    });
    return ret;
  }, []);
};

exports.bitsetStrToInt32Array = bitsetStrToInt32Array;
exports.getCRACFreeSlots = getCRACFreeSlots;
exports.makeSlots = makeSlots;
