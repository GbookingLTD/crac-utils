"use strict";

const minutesInDay = 1440;
const defaultCracTimeUnit = 5;

export const zeroBitSets = {
  5: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  1: [
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0
  ]
};

/**
 * Convert string bitset into int32 array
 * @param str bitset in string representation
 * @param cracTimeUnit CRAC bitset slot size
 * @returns {Array} int32 bitset
 */
export function bitsetStrToInt32Array(str, cracTimeUnit) {
  str = str.replace(/\./g, '');
  cracTimeUnit = cracTimeUnit || defaultCracTimeUnit;
  const numberOfTimeUnits = Math.ceil(minutesInDay / cracTimeUnit);
  if (str.length !== numberOfTimeUnits) throw Error('string bitset should contain '+numberOfTimeUnits+' chars');
  const int32Count = numberOfTimeUnits >> 5;
  let i, bi, bs = [];
  // fill bitset array
  for (i = 0; i < int32Count; ++i) {
    bs[i] = 0;
  }
  for (i = str.length - 1; i >= 0; i--) {
    // i  - char index: from numberOfTimeUnits - 1 to 0
    // bi - byte index: from 0 to 8
    bi = (numberOfTimeUnits - 1 - i) >> 5;
    bs[bi] = bs[bi] << 1 | (str[i] === "1");
  }
  return bs;
}

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
function _iterateCRACVector(offset, bitset, fn) {
  for (let bi = offset >> 5; bi < bitset.length; bi++) {
    // bi - byte index: from 0 or more to 8
    while (true) {
      // move 1 bit in mask from right to left
      // offset = 0; mask = 1 << 31
      // offset = 1; mask = 1 << 30
      // ...
      // offset = 31; mask = 1 << 0
      let mask = 1 << (31 - offset) % 32;
      let bit = bitset[bi] & mask;
      fn(bit, offset);
      if (++offset % 32 === 0) break;
    }
  }
}

/**
 * Возвращает массив свободных слотов.
 * Возвращает массив целочисленных значений, каждое из которых означает смещение слота в cracTimeUnit.
 * Таким образом, чтобы вычислить свободный слот, нужно время начала умножить на cracTimeUnit.
 * 
 * @param startOffset  смещение в CRAC векторе, считаемое в количестве бит
 * @param bitset       CRAC вектор
 * @param cracTimeUnit количество битов в слоте
 * @returns {Array}
 */
export function getCRACFreeSlots(startOffset, bitset, cracTimeUnit) {
  let freeSlots = [];
  let lenCurSlot = 0;
  let offsetCurSlot = -1;
  let fn = function (bit, offset) {
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
    
    if (offsetCurSlot >= 0 && lenCurSlot >= cracTimeUnit) {
      freeSlots.push(offsetCurSlot);
      lenCurSlot = 0;
      offsetCurSlot = -1;
    }
  };

  _iterateCRACVector(startOffset, bitset, fn);
  return freeSlots;
}
