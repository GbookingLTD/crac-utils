"use strict";

var rpcQ = require('./rpcRequest').rpcRequest
  , makeSlots = require('../dist/cjs/utils').makeSlots;

var getCRACSlots = function (endpoint, businessId, resources, taxonomyId, from, to, duration) {
  var params = [{
    "business": {"id": businessId},
    "filters": {
      "resources": resources,
      "taxonomies": [taxonomyId],
      "date": {"from": from, "to": to}
    }
  }];
  return rpcQ('Crac.GetCRACResourcesAndRooms', params, endpoint).then(function (resp) {
    return makeSlots(0, resp.result.slots, taxonomyId, duration);
  });
};

var businessId = "4000000005917";
var resources = ["5a0af90a22456774464d1fa0", "59f32b68fa2c129c154c9704"];
var taxonomyId = "2060200";

getCRACSlots('http://crac-prod3.gbooking.ru/rpc',businessId, resources, taxonomyId, 
    "2018-02-14T00:00:00.000Z", "2018-02-18T00:00:00.000Z", 30).then(function(slots) {
  console.log('slots=%s', JSON.stringify(slots, null, 4));    
});
