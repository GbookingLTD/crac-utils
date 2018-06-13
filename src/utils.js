"use strict";

import {defaultVectorSlotSize, zeroBitSets, prepareBitset, getCRACFreeSlots} from "./vector";

const INT_BITS = 32;

function _makeSlots(startOffset, date, bitset, duration, resId, taxId, vectorSlotSize) {
  vectorSlotSize = vectorSlotSize || defaultVectorSlotSize;
  let freeSlots = getCRACFreeSlots(Math.floor(startOffset / vectorSlotSize), bitset, Math.floor(30 / vectorSlotSize));
  var bod = new Date(Date.parse(date));
  return freeSlots.map(function (cracOffset) {
    var offsetMinutes = cracOffset * vectorSlotSize;
    var curD = new Date(bod);
    curD.setUTCMinutes(offsetMinutes);
    return {
      resourceId: resId,
      taxonomyId: taxId,
      start: curD.toUTCString(),
      duration: duration
    };
  });
}

export function makeSlots(startOffset, slots, taxonomyId, duration, vectorSlotSize) {
  return slots.reduce(function (ret, day) {
    var resourses = day.resources;
    if (day.excludedResources) {
      resourses = resourses.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resourses.forEach(function (r) {
      var bs = prepareBitset(r.bitset, vectorSlotSize);
      ret = ret.concat(_makeSlots(startOffset, day.date, bs, duration, r.resourceId, taxonomyId));
    });
    return ret;
  }, []);
}

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
 * @param vectorSlotSize
 * @returns {*}
 */
export function calculateWorkloadWeights(slots, vectorSlotSize) {
  return Object.values(slots.reduce(function (ret, day) {
    var resourses = day.resources;
    if (day.excludedResources) {
      resourses = resourses.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resourses.forEach(function (r) {
      var bs;
      try {
        bs = prepareBitset(r.bitset, vectorSlotSize);
      } catch (e) {
        bs = zeroBitSets[vectorSlotSize];
      }
      if (!ret[r.resourceId]) {
        ret[r.resourceId] = {
          resourceId: r.resourceId,
          weight: 0,
          firstSlotDate: day.date
        };
      }
      ret[r.resourceId].weight = ret[r.resourceId].weight + bs.reduce(function(ret, bsi) {
        return ret + bitCount32(bsi);
      }, 0);
    });
    return ret;
  }, {}));
}

function minutesFromBitset(bucket, slotIndex, vectorSlotSize) {
  return ((bucket << 5) + slotIndex) * vectorSlotSize;
}

/**
 * Calculate start and end time
 *
 * @param bitset CRAC bitset
 * @param vectorSlotSize CRAC bitset slot size
 * @returns {{start: *, end: *}}
 */
export function getFirstLastMinutes(bitset, vectorSlotSize) {
  let startBoundMinutes, endBoundMinutes;
  let startBoundBucket, startBoundIndex, endBoundBucket, endBoundIndex;
  for (let bucket = 1; bucket <= bitset.length; bucket++) {
    if (bitset[bucket] === 0) {
      continue;
    }
    for (let slotIndex = INT_BITS - 1; slotIndex !== 0; slotIndex--) {
      const bit1 = bitset[bucket] & (1 << slotIndex);
      if (bit1) {
        if (!startBoundIndex) {
          startBoundBucket = bucket;
          startBoundIndex = INT_BITS - slotIndex - 1;
        }

        endBoundBucket = bucket;
        endBoundIndex = INT_BITS - slotIndex - 1;
      }
    }
  }

  if (startBoundIndex) {
    startBoundMinutes = minutesFromBitset(startBoundBucket, startBoundIndex, vectorSlotSize);
  }
  if (endBoundIndex) {
    endBoundMinutes = minutesFromBitset(endBoundBucket, endBoundIndex + 1, vectorSlotSize);
  }

  return {
    start: startBoundMinutes,
    end: endBoundMinutes
  };
}

/**
 * Checking slot availability
 * 
 * @param bitset CRAC bitset
 * @param start start time in minutes
 * @param end end time in minutes
 * @param vectorSlotSize CRAC bitset slot size
 * @returns {boolean} availability
 */
export function isSlotAvailable(bitset, start, end, vectorSlotSize) {
  for (let time = start; time < end; time += vectorSlotSize) {
    const cracSlotIndex = parseInt(time / vectorSlotSize),
      bucket = cracSlotIndex >> 5,
      bitIndex = cracSlotIndex % INT_BITS;
    const slot = bitset[bucket] & (1 << INT_BITS - bitIndex - 1);
    if (!slot) {
      return false;
    }
  }
  return true;
}
