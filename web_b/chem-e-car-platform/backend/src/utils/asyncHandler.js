/**
 * Membungkus async route handler supaya reject promise otomatis diteruskan
 * ke error handler Express, tanpa perlu try/catch berulang di tiap route.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
