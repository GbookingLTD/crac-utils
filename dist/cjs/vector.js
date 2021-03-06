"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCracVectorSlotSize = getCracVectorSlotSize;
exports.bitsetStrToInt32Array = bitsetStrToInt32Array;
exports.prepareBitset = prepareBitset;
exports.newBusyBitset = newBusyBitset;
exports.newFreeBitset = newFreeBitset;
exports.setAnd = setAnd;
exports.setUnion = setUnion;
exports.iterateCRACVector = iterateCRACVector;
exports.getCRACFreeSlots = getCRACFreeSlots;
const minutesInDay = exports.minutesInDay = 1440;
const defaultVectorSlotSize = exports.defaultVectorSlotSize = 5;

const busyBitSets = exports.busyBitSets = {
  5: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

const freeBitSets = exports.freeBitSets = {
  5: busyBitSets[5].map(num => ~num >>> 0),
  1: busyBitSets[1].map(num => ~num >>> 0)
};

function getCracVectorSlotSize(bitset) {
  if (typeof bitset === 'string') return bitset.length > 1000 ? 1 : 5;
  return bitset.length > 9 ? 1 : 5;
}

/**
 * Convert string bitset into int32 array
 * @param str bitset in string representation
 * @param vectorSlotSize CRAC bitset slot size
 * @returns {Array} int32 bitset
 */
function bitsetStrToInt32Array(str, vectorSlotSize) {
  str = str.replace(/\./g, '');
  vectorSlotSize = vectorSlotSize || defaultVectorSlotSize;
  const numberOfTimeUnits = Math.ceil(minutesInDay / vectorSlotSize);
  if (str.length !== numberOfTimeUnits) throw Error('string bitset should contain ' + numberOfTimeUnits + ' chars');
  const int32Count = numberOfTimeUnits >> 5;
  let i,
      bi,
      bs = [];
  // fill bitset array
  for (i = 0; i < int32Count; ++i) {
    bs[i] = 0;
  }
  for (i = str.length - 1; i >= 0; i--) {
    // i  - char index: from numberOfTimeUnits - 1 to 0
    // bi - byte index: from 0 to 8
    bi = numberOfTimeUnits - 1 - i >> 5;
    bs[bi] = (bs[bi] << 1 | str[i] === "1") >>> 0;
  }
  return bs;
}

function prepareBitset(bitset, vectorSlotSize) {
  return typeof bitset === "string" ? bitsetStrToInt32Array(bitset, vectorSlotSize) : bitset;
}

function newBusyBitset(vectorSlotSize) {
  return busyBitSets[vectorSlotSize].slice();
}

function newFreeBitset(vectorSlotSize) {
  return freeBitSets[vectorSlotSize].slice();
}

/**
 * And operation by bit between 2 sets
 *
 * @param {Array<Number>} setA
 * @param {Array<Number>} setB
 */
function setAnd(setA, setB) {
  let unifiedSet = [];
  for (let i = 0; i < setA.length; i++) {
    unifiedSet[i] = (setA[i] & setB[i]) >>> 0;
  }
  return unifiedSet;
}

/**
 * OR operation by bit between 2 sets
 *
 * @param {Array<Number>} setA
 * @param {Array<Number>} setB
 */
function setUnion(setA, setB) {
  let unifiedSet = [];
  for (let i = 0; i < setA.length; i++) {
    unifiedSet[i] = (setA[i] | setB[i]) >>> 0;
  }
  return unifiedSet;
}

/**
 * Итерирует CRAC-вектор по битам в нём.
 * Функция итератора принимает 2 аргумента
 *  - числовое значение бита
 *  - смещение этого бита в CRAC векторе
 * 
 * @param bitset
 * @param fn
 * @param offset
 * @param end
 */
function iterateCRACVector(bitset, fn, offset = 0, end = undefined) {
  for (let bi = offset >> 5; bi < bitset.length; bi++) {
    // bi - byte index: from 0 or more to 8
    while (true) {
      if (end && offset >= end) return;
      // move 1 bit in mask from right to left
      // offset = 0; mask = 1 << 31
      // offset = 1; mask = 1 << 30
      // ...
      // offset = 31; mask = 1 << 0
      let mask = 1 << 31 - offset;
      let bit = bitset[bi] & mask;
      fn(bit, offset);
      if (++offset % 32 === 0) break;
    }
  }
}

/**
 * Возвращает массив свободных слотов в виде массива смещений, относительно начала вектора.
 * Возвращает массив целочисленных значений, каждое из которых означает смещение слота в cracTimeUnit.
 * Таким образом, чтобы вычислить свободный слот, нужно время начала умножить на cracTimeUnit.
 * 
 * @param bitset       CRAC вектор
 * @param scheduleSlotSize     Количество битов в слоте
 * @param [offset=0]   Смещение в CRAC векторе, считаемое в количестве бит
 * @returns {Array}
 */
function getCRACFreeSlots(bitset, scheduleSlotSize, offset = 0) {
  let freeSlots = [];
  let slotLen = 0;
  let slotOffset = -1;
  let fn = function (bit, offset) {
    if (slotOffset < 0) {
      // found first slot bit
      if (bit) {
        slotOffset = offset;
        slotLen = 1;
      }
    } else {
      // continue crac slot reading
      if (bit === 0) {
        slotLen = 0;
        slotOffset = -1;
      } else {
        ++slotLen;
      }
    }

    if (slotOffset >= 0 && slotLen >= scheduleSlotSize) {
      freeSlots.push(slotOffset);
      slotLen = 0;
      slotOffset = -1;
    }
  };

  iterateCRACVector(bitset, fn, offset);
  return freeSlots;
}