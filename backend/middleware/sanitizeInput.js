const mongoSanitize = require('mongo-sanitize');
const querystring = require('node:querystring');

function sanitizeQuery(query) {
  return mongoSanitize({ ...querystring.parse(query) });
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = mongoSanitize(req.body);
  }
  return next();
}

module.exports = { sanitizeInput, sanitizeQuery };
