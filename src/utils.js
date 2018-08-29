"use strict";

import {defaultVectorSlotSize, busyBitSets, prepareBitset, getCRACFreeSlots, 
  newBusyBitset, newFreeBitset, setAnd, setUnion} from "./vector";

const INT32_SIZE = 32;

function _makeSlots(startOffset, date, bitset, duration, resId, taxId, vectorSlotSize) {
  vectorSlotSize = vectorSlotSize || defaultVectorSlotSize;
  let freeSlots = getCRACFreeSlots(Math.floor(startOffset / vectorSlotSize), bitset, Math.floor(30 / vectorSlotSize));
  let bod = new Date(Date.parse(date));
  return freeSlots.map(function (cracOffset) {
    let offsetMinutes = cracOffset * vectorSlotSize;
    let curD = new Date(bod);
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
    let resources = day.resources;
    if (day.excludedResources) {
      resources = resources.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resources.forEach(function (r) {
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
  vectorSlotSize = vectorSlotSize || defaultVectorSlotSize;
  return Object.values((slots || []).reduce(function (ret, day) {
    let resources = day.resources;
    if (day.excludedResources) {
      resources = resources.filter(function (r) {
        return day.excludedResources.indexOf(r.resourceId) < 0;
      });
    }
    
    resources.forEach(function (r) {
      let bs;
      try {
        bs = prepareBitset(r.bitset, vectorSlotSize);
      } catch (e) {
        bs = busyBitSets[vectorSlotSize];
      }

      if (!ret[r.resourceId]) {
        ret[r.resourceId] = {
          resourceId: r.resourceId,
          weight: 0,
          firstSlotDate: null,
          firstSlotStartMinutes: 0
        };
      }

      if (ret[r.resourceId].firstSlotDate === null) {
        let minutes;
        let p = {i: 0, b: 0};
        if (_find1(p, bs) === -1) {
          minutes = 0;
        } else {
          minutes = (p.i * INT32_SIZE + p.b + 1) * vectorSlotSize;
        }
        if (minutes) {
          ret[r.resourceId].firstSlotDate = day.date;
          ret[r.resourceId].firstSlotStartMinutes = minutes;
        }
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
  for (let i = 0; i < bitset.length; ++i) {
    let b = Math.clz32(bitset[i]);
    if (b < INT32_SIZE) {
      startBoundBucket = i;
      startBoundIndex = b;
      break;
    }
  }
  
  for (let i = bitset.length - 1; i >= startBoundBucket; --i) {
    if (bitset[i]) {
      for (let b = INT32_SIZE - 1; b >= 0; --b) {
        let bit = bitset[i] & (1 << INT32_SIZE - b - 1);
        if (bit) {
          endBoundBucket = i;
          endBoundIndex = b;
          break;
        } 
      }
      
      if (endBoundIndex) break;
    }
  }
  
  if (typeof startBoundIndex !== 'undefined') {
    startBoundMinutes = minutesFromBitset(startBoundBucket, startBoundIndex, vectorSlotSize);
  }
  if (typeof endBoundIndex !== 'undefined') {
    endBoundMinutes = minutesFromBitset(endBoundBucket, endBoundIndex + 1, vectorSlotSize);
  }

  return {
    start: startBoundMinutes,
    end: endBoundMinutes
  };
}

/**
 * Находит позицию первой 1 в векторе. 
 * Направление битов - слева направо (от старших к младшим разрядам), поэтому возможно использовать clz внутри числа.
 * 
 * Если не найдено 1 - возвращаем отрицательное число.
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
    if (p.b >= 32) {
      p.b = 0;
      ++p.i;
      continue;
    }
    
    // найдена 1 - возвращаем результат
    return 0;
  }
  
  // весь вектор заполнен 0, возвращаем отрицательное число
  return -1;
}

/**
 * Производит поиск 0 бита в обратном направлении. 
 * Возвращает количество бит, на которое нужно было сместиться назад.
 * 
 * @param vector crac-vector
 * @param p      позиция на векторе, с которой начинается поиск
 * @param count  количество бит, в которых производится поиск
 * @return {number}
 * @private
 */
export function _findBack0(vector, p, count) {
  let offset = 0;
  while (p.i >= 0) {
    // найден 0 бит - возвращаем результат
    const bit = vector[p.i] >>> (INT32_SIZE - p.b - 1) & 1;
    if (bit === 0) {
      return offset;
    }
    
    ++offset;
    if (count-- < 0) return -1;
    
    --p.b;
    if (p.b < 0) {
      p.b = 31;
      --p.i;
    }
  }
  
  return -1;
}

/**
 * Маски левых (старших) единиц от 0 до 32-х (33 элемента в массиве).
 * 
 * 0-й элемент соответствует нулю единиц слева, начиная от 32-й позиции.
 * 1-й элемент соответствует одной единице слева на 32-й позиции и тд. до 32-х.
 * 32-й элемент соответствует 32-м единицам от 32-й до крайней правой позиции.
 * 
 * @type {{}}
 */
export const mask_left1 = [
  0,2147483648,3221225472,3758096384,
  4026531840,4160749568,4227858432,4261412864,
  4278190080,4286578688,4290772992,4292870144,
  4293918720,4294443008,4294705152,4294836224,
  4294901760,4294934528,4294950912,4294959104,
  4294963200,4294965248,4294966272,4294966784,
  4294967040,4294967168,4294967232,4294967264,
  4294967280,4294967288,4294967292,4294967294,
  4294967295
];


/**
 * Маски правых (младших) единиц от 0 до 32-х (33 элемента в массиве).
 * 
 * @type {{}}
 */
export const mask_right1 = [
  0,1,3,7,
  15,31,63,127,
  255,511,1023,2047,
  4095,8191,16383,32767,
  65535,131071,262143,524287,
  1048575,2097151,4194303,8388607,
  16777215,33554431,67108863,134217727,
  268435455,536870911,1073741823,2147483647,
  4294967295
];

/*
(() => {
let m = new Array(33);
m[0] = 0;
for (let i = 0; i < 32; ++i) {
  // m[32 - i] = (0xffffffff << i) >>> 0; // for mask_left1
  m[32 - i] = 0xffffffff >>> i; // for mask_right1
}
return m;
})()
*/

/**
 * Заполнение результирующего вектора 1.
 * 
 * @param bitset crac-вектор
 * @param i    начальное смещение элементов массива
 * @param b    начальное смещение в битах в элементе массива
 * @param count количество бит, которое необходимо заполнить
 * @private
 */
export function _fill1 (bitset, i, b, count) {
  let left_bound = b;
  let right_bound = Math.min(count + b, INT32_SIZE);
  for (;i < bitset.length && count > 0; ++i) {
    bitset[i] = (
      bitset[i] | 
      mask_left1[right_bound] & mask_right1[INT32_SIZE - left_bound]
    ) >>> 0;
    count -= right_bound - left_bound;
    left_bound = 0;
    right_bound = count >= INT32_SIZE ? INT32_SIZE : count;
  }
}

/**
 * Checking slot availability
 * 
 * @param bitset CRAC bitset
 * @param start start time in minutes
 * @param end end time in minutes (not inclusive)
 * @param vectorSlotSize CRAC bitset slot size
 * @returns {boolean} availability
 */
export function isSlotAvailable(bitset, start, end, vectorSlotSize) {
  let cracSlotIndex = Math.floor(start / vectorSlotSize),
      i = cracSlotIndex >> 5,
      b = cracSlotIndex % INT32_SIZE,
      count = Math.ceil((end - start) / vectorSlotSize);
  
  if (count === 0) return false;
  
  let left_bound = b;
  let right_bound = Math.min(count + b, INT32_SIZE);
  for (;i < bitset.length && count > 0; ++i) {
    let slot_mask = (mask_left1[right_bound] & mask_right1[INT32_SIZE - left_bound]) >>> 0;
    if (((bitset[i] | slot_mask) ^ bitset[i]) >>> 0) return false;
    count -= right_bound - left_bound;
    left_bound = 0;
    right_bound = count >= INT32_SIZE ? INT32_SIZE : count;
  }
  
  return true;
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
 * @param vectorSlotSize
 */
export function buildBookingCRACVector(bitset, offset, sz, vectorSlotSize) {
  let r = newBusyBitset(vectorSlotSize);
  let p = {};
  p.i = Math.floor(offset / INT32_SIZE);
  p.b = offset % INT32_SIZE;
  
  const inverseBitset = bitset.map(n => (~n)>>>0);
  while (p.i < bitset.length) {
    // Находим первую 1 ("свободный" бит).
    // Если достигнут конец входного вектора, то возвращаем результирующий вектор.
    if (_find1(p, bitset) < 0) return r;

    // Все биты до него заняты. 
    // Вектор r и так заполнен 0, поэтому заполнения 0 не требуется.

    // Находим первый 0 ("занятый" бит), начиная с текущей позиции.
    // Если "занятый" бит не был найден, то берём весь оставшийся вектор.
    let pp = {i: p.i, b: p.b};
    _find1(p, inverseBitset);
    
    // Находим количество бит, которое нужно заполнить
    let prevPos = pp.i * INT32_SIZE + pp.b;
    let pos = p.i * INT32_SIZE + p.b;
    let fillCount = pos - prevPos - sz + 1;
    if (fillCount > 0) {
      // Заполняем результирующий вектор 1
      _fill1(r, pp.i, pp.b, fillCount);
    }
  }
  
  return r;
}

/**
 * Сдвигает все биты crac-вектора на shift позиций влево.
 * Изменяет входящий массив и возвращает изменённый массив.
 * 
 * Функция имеет сложность O(n), n - количество элементов в массиве.
 * 
 * @param {Array<Number>} bitset
 * @param {Number} shift
 * @return {Array<Number>}
 * @private
 */
export function _vectorLeftShift(bitset, shift) {
  let k = Math.floor(shift / INT32_SIZE);
  if (k) {
    // Если смещение превышает 32, то смещаем числа на k элементов. 
    // Остальлные элементы заполяем 0.
    for (let i = 0; i < bitset.length - k; ++i) {
      bitset[i] = bitset[i + k];
    }
    for (let i = bitset.length - k; i < bitset.length; ++i) {
      bitset[i] = 0;
    }
  }
  
  let leftBits = 0 
    , prevLeftBits
    , b = shift % INT32_SIZE;
  for (let i = bitset.length - k - 1; i >= 0; --i) {
    // Берём левые биты текущего числа, переносим их направо, чтобы сохранить в нижних регистрах следующего числа.
    prevLeftBits = (bitset[i] >>> INT32_SIZE - b) & mask_right1[b];
    bitset[i] = (bitset[i] << b | leftBits) >>> 0;
    leftBits = prevLeftBits;
  }
  
  return bitset;
}

/**
 * Строит вектор возможности записи на непрерывную последовательность услуг.
 * 
 * @param {Array<Array<Number>>} bookingBitSets массив векторов возможности записи
 * @param {Array<Number>} durations массив продолжительностей услуг в минутах
 * @param vectorSlotSize
 * @return {Array<Array<Number>>}
 */
export function buildSequenceBookingCRACVector(bookingBitSets, durations, vectorSlotSize) {
  let leftShift = 0;
  let bookingVector = newFreeBitset(vectorSlotSize);
  for (let i = 0; i < bookingBitSets.length; i++) {
    let curBookingVector = bookingBitSets[i];
    
    // Сдвигаем вектор на суммарную длительность всех предыдущих услуг
    if (leftShift) {
      curBookingVector = _vectorLeftShift(curBookingVector.slice(), leftShift);
    }
    
    bookingVector = setAnd(bookingVector, curBookingVector);
    
    // Вычисляем сдвиг следующего вектора
    leftShift += Math.floor(durations[i] / vectorSlotSize);
  }
  
  return bookingVector;
}

export function printCRACVector(bitset, int32delimiter = '.') {
  return bitset.reduce((ret, /* Number */ n) => {
    let sn = n.toString(2);
    ret += (ret ? int32delimiter : '') + '0'.repeat(INT32_SIZE - sn.length) + sn;
    return ret;
  }, '');
}
