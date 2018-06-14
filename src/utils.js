"use strict";

import {defaultVectorSlotSize, zeroBitSets, prepareBitset, getCRACFreeSlots, newBusyBitset} from "./vector";

const INT32_SIZE = 32;

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
    for (let slotIndex = INT32_SIZE - 1; slotIndex !== 0; slotIndex--) {
      const bit1 = bitset[bucket] & (1 << slotIndex);
      if (bit1) {
        if (!startBoundIndex) {
          startBoundBucket = bucket;
          startBoundIndex = INT32_SIZE - slotIndex - 1;
        }

        endBoundBucket = bucket;
        endBoundIndex = INT32_SIZE - slotIndex - 1;
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
      bitIndex = cracSlotIndex % INT32_SIZE;
    const bit = bitset[bucket] & (1 << INT32_SIZE - bitIndex - 1);
    if (!bit) {
      return false;
    }
  }
  return true;
}

/**
 * Находит позицию первой 1 в векторе. 
 * Направление битов - слева направо (от старших к младшим разрядам), поэтому возможно использовать clz внутри числа.
 * 
 * @param {{i:number, b:number}} p
 * @param vector
 * @return {*}
 * @private
 */
export function _find1 (p, vector) {
  while (p.i < vector.length) {
    p.b = Math.clz32(vector[p.i] << p.b) + p.b;
    // все 0 - проверяем следующее число
    if (p.b === 32) {
      p.b = 0;
      ++p.i;
      continue;
    }
    
    // найдена 1 - возвращаем результат
    return 0;
  }
  
  // весь вектор заполнен 0
  return -1;
}

/**
 * маски левых единиц от 0 до 32-х.
 * 
 * @type {{}}
 */
const mask_left1 = {
  // todo fill mask_left1
};

/**
 * маски правых единиц от 0 до 32-х.
 * 
 * @type {{}}
 */
const mask_right1 = {
  // todo fill mask_right1
};

/**
 * Заполнение результирующего вектора 1.
 * 
 * @param dist
 * @param i
 * @param b
 * @param count
 * @private
 */
export function _fill1 (dist, i, b, count) {
  let k = Math.floor(count / INT32_SIZE);
  dist[i] = dist[i] | mask_right1[b];
  do {
    dist[i] = dist[i] | mask_left1[count > INT32_SIZE ? 32 : count % INT32_SIZE];
    b = 0;
    ++i;
    --k;
    count -= INT32_SIZE;
  } while (k >= 0 && i < dist.length);
}

/**
 * Возвращаем вектор, в котором 1 означает возможность записи на это время с учётом 
 * переданной длительности.
 * 
 * Переходим на первый свободный бит. Очевидно, что все биты до него заняты. 
 * Находим первый занятый бит, идущий за свободным. 
 * Все биты, которые отстоят от этого занятого на расстояние duration будут свободны.
 *
 * Операция "найти первый свободный бит" оптимизирована с помощью операции Math.clz32.
 * Операции заполнения битов используют битовые маски.
 * 
 * Функция имеет сложность O(n), n - количество элементов в массиве (не бит, в отличие от простого итерирования по CRAC-вектору).
 * 
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
 * 
 * @param bitset
 * @param offset смещение в crac-векторе
 * @param sz
 */
export function buildBookingCRACVector(bitset, offset, sz) {
  let r = newBusyBitset();
  let p = {};
  p.i = Math.floor(offset / INT32_SIZE);
  p.b = offset % INT32_SIZE - 1;
  
  const inverseBitset = bitset.map(n => ~n);
  
  while (p.i < bitset.length) {
    // находим первую 1 ("свободный" бит)
    // если достигнут конец входного вектора, то возвращаем результирующий вектор
    if (_find1(p, bitset) < 0) return r;

    // все биты до него заняты (вектор r и так заполнен 0)

    // находим первый 0 ("занятый" бит), начиная с текущей позиции
    let pp = {i: p.i, b: p.b};
    _find1(p, inverseBitset);
    
    // находим количество бит, которое нужно заполнить
    let prevPos = pp.i * INT32_SIZE + pp.b;
    let pos = p.i * INT32_SIZE + p.b;
    let fillCount = pos - sz - prevPos;
    if (fillCount > 0) {
      // заполняем результирующий вектор 1
      _fill1(r, pp.i, pp.b, fillCount);
    }
  }
  
  return r;
}

/**
 * Сдвигаем все биты crac-вектора на shift позиций влево.
 * 
 * Функция имеет сложность O(n), n - количество элементов в массиве.
 * 
 * @param bitset
 * @param shift
 * @private
 */
function _vectorLeftShift(bitset, shift) {
  let k = Math.floor(shift / INT32_SIZE);
  if (k) {
    for (let i = 0; i < bitset.length - k; ++i) {
      bitset[i] = bitset[i + k];
    }
  }
  
  let leftBits, prevLeftBits, b = shift % INT32_SIZE - 1;
  for (let i = bitset.length - k; i >= 0; --i) {
    leftBits = bitset[i] >> b; // здесь нужно заполнить правые нулями
    bitset[i] = bitset[i] << b | leftBits;
    prevLeftBits = leftBits;
  }
}


/**
 * Строит вектор возможности записи на непрерывную последовательность услуг. 
 * 
 * @param {Array<Array<Number>>} bitSets
 * @param {Array<Number>} durations
 * @param vectorSlotSize
 */
export function buildSequenceBookingCRACVector(bitSets, durations, vectorSlotSize) {
  let leftShift = 0;
  let bookingVector = newFreeBitset(vectorSlotSize);
  for (let i = 1; i < bitSets.length; i++) {
    let curBookingVector = bitSets[i];
    
    // Сдвигаем вектор на суммарную длительность всех предыдущих услуг
    if (leftShift) {
      curBookingVector = _vectorLeftShift(curBookingVector, leftShift);
    }
    
    bookingVector = setAnd(bookingVector, curBookingVector);
    
    // Вычисляем сдвиг следующего вектора
    leftShift += durations[i] / vectorSlotSize;
  }
  
  return bookingVector;
}