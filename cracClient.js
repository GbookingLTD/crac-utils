"use strict";

var _ = require('lodash');

function bitsetStrToInt32Array(s) {
  //console.log(s.length / 32);
  var bi, bs = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (var i = s.length - 1; i >= 0; i--) {
    bi = i >> 5;
    bs[bi] = bs[bi] << 1 | (s[i] === "1");
  }
  return bs;
}

var _iterateCRACVector = function (offset, bitset, fn) {
  for (var bi = offset >> 5; bi < bitset.length; bi++) {
    while (true) {
      var bit = bitset[bi] & (1 << offset % 32);
      fn(bit, offset);
      if (++offset % 32 === 0) break;
    }
  }
};

function getCRACFreeSlots(cracCellOffset, bitset, slotCells) {
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
        if (++lenCurSlot >= slotCells) {
          freeSlots.push(offsetCurSlot);
          lenCurSlot = 0;
          offsetCurSlot = -1;
        }
      }
    }
  };

  _iterateCRACVector(cracCellOffset, bitset, fn);
  return freeSlots;
}

function _makeSlots(date, bitset, duration, resId, taxId) {
  var cracTimeUnit = 5;
  var freeSlots = getCRACFreeSlots(Math.floor(600 / cracTimeUnit), bitset, Math.floor(30 / cracTimeUnit));
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

exports.prepareSlots = function (slots, taxonomyId, duration) {
  return _.reduce(slots, function (ret, day) {
    day.resources.filter(function (r) {
      return day.excludedResources.indexOf(r.resourceId) < 0;
    }).forEach(function (r) {
      var bs = (typeof r.bitset === "string") ? bitsetStrToInt32Array(r.bitset) : r.bitset;
      ret = ret.concat(_makeSlots(day.date, bs, duration, r.resourceId, taxonomyId));
    });
    return ret;
  }, []);
};
