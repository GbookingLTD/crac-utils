"use strict";

import * as _ from 'lodash';
import {zeroBitSets, bitsetStrToInt32Array, getCRACFreeSlots} from "./vector";

function _makeSlots(startOffset, date, bitset, duration, resId, taxId, cracTimeUnit) {
  cracTimeUnit = cracTimeUnit || defaultCracTimeUnit;
  let freeSlots = getCRACFreeSlots(Math.floor(startOffset / cracTimeUnit), bitset, Math.floor(30 / cracTimeUnit));
  var bod = new Date(Date.parse(date));
  return freeSlots.map(function (cracOffset) {
    var offsetMinutes = cracOffset * cracTimeUnit;
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

export function makeSlots(startOffset, slots, taxonomyId, duration, cracTimeUnit) {
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
 * @param cracTimeUnit
 * @returns {*}
 */
export function calculateWorkloadWeights(slots, cracTimeUnit) {
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
        bs = zeroBitSets[cracTimeUnit];
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
}
