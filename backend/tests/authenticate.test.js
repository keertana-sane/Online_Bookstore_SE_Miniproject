const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createAuthenticateMiddleware } = require('../middleware/authenticate');

const JWT_SECRET = 'test-secret-for-authentication';

function createApp(securityLogger = () => {}) {
  const app = express();
  app.get(
    '/protected',
    createAuthenticateMiddleware({ jwtSecret: JWT_SECRET, securityLogger }),
    (req, res) => res.json({ user: req.user })
  );
  return app;
}

describe('JWT authentication middleware', () => {
  test('returns 401 when the bearer token is missing', async () => {
    const securityLogger = jest.fn();
    const response = await request(createApp(securityLogger)).get('/protected').expect(401);
    expect(response.body.error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Login required'
    });
    expect(securityLogger).toHaveBeenCalledWith(expect.anything(), 'unauthorized_access');
  });

  test('returns 401 for an expired token', async () => {
    const token = jwt.sign(
      { role: 'CUSTOMER', sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 1 },
      JWT_SECRET,
      { algorithm: 'HS256', noTimestamp: true }
    );
    await request(createApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  test('returns 401 for a tampered token', async () => {
    const token = jwt.sign({ role: 'CUSTOMER' }, JWT_SECRET, {
      algorithm: 'HS256',
      subject: 'user-1'
    });
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    await request(createApp())
      .get('/protected')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
  });

  test('sets the verified subject and role on the request', async () => {
    const token = jwt.sign({ role: 'CUSTOMER' }, JWT_SECRET, {
      algorithm: 'HS256',
      subject: 'user-1',
      expiresIn: 3600
    });
    const response = await request(createApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.user).toEqual({ id: 'user-1', role: 'CUSTOMER' });
  });

  test('requires a JWT secret at middleware initialization', () => {
    expect(() => createAuthenticateMiddleware({ jwtSecret: '' })).toThrow(
      'JWT_SECRET must be set'
    );
  });
});
