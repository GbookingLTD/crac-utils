"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calcCRACSlotIntermediate = exports.printCRACVector = exports.buildSequenceBookingCRACVector = exports.buildBookingCRACVector = exports.isSlotAvailable = exports.getFirstLastMinutes = exports.calculateWorkloadWeights = exports.makeSlots = exports.getCRACFreeSlots = exports.iterateCRACVector = exports.setUnion = exports.setAnd = exports.prepareBitset = exports.bitsetStrToInt32Array = exports.newFreeBitset = exports.newBusyBitset = exports.freeBitSets = exports.busyBitSets = exports.defaultVectorSlotSize = undefined;

var _vector = require("./vector");

var _utils = require("./utils");

exports.defaultVectorSlotSize = _vector.defaultVectorSlotSize;
exports.busyBitSets = _vector.busyBitSets;
exports.freeBitSets = _vector.freeBitSets;
exports.newBusyBitset = _vector.newBusyBitset;
exports.newFreeBitset = _vector.newFreeBitset;
exports.bitsetStrToInt32Array = _vector.bitsetStrToInt32Array;
exports.prepareBitset = _vector.prepareBitset;
exports.setAnd = _vector.setAnd;
exports.setUnion = _vector.setUnion;
exports.iterateCRACVector = _vector.iterateCRACVector;
exports.getCRACFreeSlots = _vector.getCRACFreeSlots;
exports.makeSlots = _utils.makeSlots;
exports.calculateWorkloadWeights = _utils.calculateWorkloadWeights;
exports.getFirstLastMinutes = _utils.getFirstLastMinutes;
exports.isSlotAvailable = _utils.isSlotAvailable;
exports.buildBookingCRACVector = _utils.buildBookingCRACVector;
exports.buildSequenceBookingCRACVector = _utils.buildSequenceBookingCRACVector;
exports.printCRACVector = _utils.printCRACVector;
exports.calcCRACSlotIntermediate = _utils.calcCRACSlotIntermediate;