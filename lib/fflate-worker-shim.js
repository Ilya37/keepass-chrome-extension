// Shim for fflate's worker module.
// Chrome MV3 Service Workers cannot use new Worker().
// kdbxweb only uses gzipSync/gunzipSync which don't need workers.
module.exports = function() {
  throw new Error('Workers are not supported in Chrome MV3 Service Workers');
};
module.exports.default = module.exports;
