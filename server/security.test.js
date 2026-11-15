const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const helmet = require('helmet');
const request = require('supertest');
const { sanitizeInput, sanitizeQuery } = require('../backend/middleware/sanitizeInput');
const { logSecurityEvent } = require('../backend/utils/securityEvents');
const { errorHandler } = require('./errorHandler');
const { requestLogger } = require('./requestLogger');

function createSecurityTestApp() {
  const app = express();
  app.use(helmet());
  app.use(requestLogger);
  app.set('query parser', sanitizeQuery);
  app.use(express.json({ limit: '32kb' }));
  app.use(sanitizeInput);
  app.post('/echo', (req, res) => res.json({ body: req.body, query: req.query }));
  app.get('/failure', (req, res, next) => next(new Error('private database detail')));
  app.get('/payment-timeout', (req, res, next) =>
    next(Object.assign(new Error('The payment service did not respond in time'), { status: 504, code: 'PAYMENT_TIMEOUT' })));
  app.get('/other-504', (req, res, next) =>
    next(Object.assign(new Error('upstream secret'), { status: 504, code: 'UPSTREAM_SECRET' })));
  app.use(errorHandler);
  return app;
}

test('security middleware strips Mongo operators and sets Helmet/request ID headers', async (t) => {
  t.mock.method(console, 'info', () => {});
  const response = await request(createSecurityTestApp())
    .post('/echo?safe=value&%24where=malicious')
    .send({ $where: 'malicious', name: 'Reader' })
    .expect(200);

  assert.deepEqual(response.body, {
    body: { name: 'Reader' },
    query: { safe: 'value' }
  });
  assert.ok(response.headers['content-security-policy']);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['x-request-id']);
});

test('central errors use the envelope without exposing stack details', async (t) => {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
  const response = await request(createSecurityTestApp()).get('/failure').expect(500);

  assert.deepEqual(response.body.error, {
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong',
    requestId: response.headers['x-request-id']
  });
  assert.equal(JSON.stringify(response.body).includes('private database detail'), false);
  assert.equal(JSON.stringify(response.body).includes('stack'), false);
});

test('a payment timeout keeps its SAD code PAYMENT_TIMEOUT (API-09) but other 5xx stay generic', async (t) => {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
  const timeout = await request(createSecurityTestApp()).get('/payment-timeout').expect(504);
  assert.equal(timeout.body.error.code, 'PAYMENT_TIMEOUT');
  assert.equal(timeout.body.error.message, 'The payment service did not respond in time');

  const other = await request(createSecurityTestApp()).get('/other-504').expect(504);
  assert.equal(other.body.error.code, 'INTERNAL_ERROR');
  assert.equal(other.body.error.message, 'Something went wrong');
});

test('malformed JSON also returns the standard client error envelope', async (t) => {
  t.mock.method(console, 'info', () => {});
  const response = await request(createSecurityTestApp())
    .post('/echo')
    .set('Content-Type', 'application/json')
    .send('{"broken":')
    .expect(400);

  assert.equal(response.body.error.code, 'BAD_REQUEST');
  assert.equal(typeof response.body.error.requestId, 'string');
  assert.equal(JSON.stringify(response.body).includes('SyntaxError'), false);
});

test('security events include timestamp, request metadata and known user id without credentials', (t) => {
  const logged = [];
  t.mock.method(console, 'warn', (message) => logged.push(message));
  logSecurityEvent({
    requestId: 'request-1',
    ip: '127.0.0.1',
    method: 'GET',
    path: '/api/v1/admin/orders',
    user: { id: 'customer-1' },
    body: { password: 'must-not-be-logged', token: 'must-not-be-logged' }
  }, 'unauthorized_access');

  assert.equal(logged.length, 1);
  const event = JSON.parse(logged[0]);
  assert.equal(event.event, 'unauthorized_access');
  assert.ok(Number.isNaN(Date.parse(event.timestamp)) === false);
  assert.equal(event.requestId, 'request-1');
  assert.equal(event.ip, '127.0.0.1');
  assert.equal(event.method, 'GET');
  assert.equal(event.path, '/api/v1/admin/orders');
  assert.equal(event.userId, 'customer-1');
  assert.equal(logged[0].includes('must-not-be-logged'), false);
});
