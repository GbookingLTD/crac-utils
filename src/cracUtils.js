"use strict";

var _ = require('lodash');

var defaultCracTimeUnit = 5;

var bitsetStrToInt32Array = function (s, cracTimeUnit) {
  s = s.replace(/\./g, '');
  cracTimeUnit = cracTimeUnit || defaultCracTimeUnit;
  var numberOfTimeUnits = Math.ceil(1440 / cracTimeUnit);
  if (s.length !== numberOfTimeUnits) throw Error('string bitset should contain '+numberOfTimeUnits+' chars');
  var int32Count = numberOfTimeUnits >> 5;
  var i, bi, bs = [];
  // fill bitset array
  for (i = 0; i < int32Count; ++i) {
    bs[i] = 0;
  }
  for (i = s.length - 1; i >= 0; i--) {
    // i  - char index: from numberOfTimeUnits - 1 to 0
    // bi - byte index: from 0 to 8
    bi = (numberOfTimeUnits - 1 - i) >> 5;
    bs[bi] = bs[bi] << 1 | (s[i] === "1");
  }
  return bs;
};

/**
 * Итерирует CRAC-вектор по битам в нём.
 * Функция итератора принимает 2 аргумента
 *  - числовое значение бита
 *  - смещение этого бита в CRAC векторе
 * 
 * @param offset
 * @param bitset
 * @param fn
 * @private
 */
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

/**
 * Возвращает массив свободных слотов.
 * Возвращает массив целочисленных значений, каждое из которых означает смещение слота в cracTimeUnit.
 * Таким образом, чтобы вычислить свободный слот, нужно время начала умножить на cracTimeUnit.
 * 
 * @param cracCellOffset смещение в CRAC векторе
 * @param bitset         CRAC вектор
 * @param slotCells      количество битов в слоте
 * @returns {Array}
 */
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

function _makeSlots(startOffset, date, bitset, duration, resId, taxId, cracTimeUnit) {
  cracTimeUnit = cracTimeUnit || defaultCracTimeUnit;
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

var makeSlots = function (startOffset, slots, taxonomyId, duration, cracTimeUnit) {
  return _.reduce(slots, function (ret, day) {
    var resourses = day.resources;
    if (day.excludedResources) {
      resourses = resourses.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resourses.forEach(function (r) {
      var bs = (typeof r.bitset === "string") ? bitsetStrToInt32Array(r.bitset, cracTimeUnit) : r.bitset;
      ret = ret.concat(_makeSlots(startOffset, day.date, bs, duration, r.resourceId, taxonomyId));
    });
    return ret;
  }, []);
};

/**
 * 
 * @see https://stackoverflow.com/questions/43122082/efficiently-count-the-number-of-bits-in-an-integer-in-javascript
 * @see https://graphics.stanford.edu/~seander/bithacks.html
 * 
 * @param n
 * @returns {number}
 */
function bitCount32 (n) {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
}

/**
 * The calculation workload of resources.
 * It helpful for a sorting from less loaded resource to most one.
 * 
 * A weight of resource is number of "1" bits in all bitsets by all passed days.
 * 
 * @param slots
 * @param cracTimeUnit
 * @returns {*}
 */
var calculateWorkloadWeights = function(slots, cracTimeUnit) {
  return _.values(_.reduce(slots, function (ret, day) {
    var resourses = day.resources;
    if (day.excludedResources) {
      resourses = resourses.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resourses.forEach(function (r) {
      var bs;
      try {
        bs = (typeof r.bitset === "string") ? bitsetStrToInt32Array(r.bitset, cracTimeUnit) : r.bitset;
      } catch (e) {
        bs = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
      if (!ret[r.resourceId]) {
        ret[r.resourceId] = {
          resourceId: r.resourceId,
          weight: 0,
          firstSlotDate: day.date
        };
      }
      ret[r.resourceId].weight = ret[r.resourceId].weight + _.reduce(bs, function(ret, bsi) {
        return ret + bitCount32(bsi);
      }, 0);
    });
    return ret;
  }, {}));
};

exports.bitsetStrToInt32Array = bitsetStrToInt32Array;
exports.getCRACFreeSlots = getCRACFreeSlots;
exports.makeSlots = makeSlots;
exports.calculateWorkloadWeights = calculateWorkloadWeights;
