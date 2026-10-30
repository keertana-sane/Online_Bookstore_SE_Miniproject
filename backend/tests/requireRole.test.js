const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createAuthenticateMiddleware } = require('../middleware/authenticate');
const { createRequireRoleMiddleware } = require('../middleware/requireRole');

const JWT_SECRET = 'test-secret-for-rbac';

function tokenFor(role) {
  return jwt.sign({ role }, JWT_SECRET, {
    algorithm: 'HS256',
    subject: `${role.toLowerCase()}-user`,
    expiresIn: 3600
  });
}

function createApp(securityLogger = () => {}) {
  const app = express();
  const authenticate = createAuthenticateMiddleware({ jwtSecret: JWT_SECRET, securityLogger });
  const requireAdmin = createRequireRoleMiddleware('ADMIN_STAFF', { securityLogger });
  const adminRouter = express.Router();

  adminRouter.use(authenticate, requireAdmin);
  adminRouter.get('/books', (req, res) => res.json({ route: 'books' }));
  adminRouter.get('/orders', (req, res) => res.json({ route: 'orders' }));
  app.use('/api/v1/admin', adminRouter);
  return app;
}

describe('admin role authorization', () => {
  test.each(['/api/v1/admin/books', '/api/v1/admin/orders'])(
    'returns 403 to a customer on %s',
    async (path) => {
      const response = await request(createApp())
        .get(path)
        .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
        .expect(403);

      expect(response.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource'
      });
    }
  );

  test('allows an admin role on protected admin routes', async () => {
    await request(createApp())
      .get('/api/v1/admin/books')
      .set('Authorization', `Bearer ${tokenFor('ADMIN_STAFF')}`)
      .expect(200, { route: 'books' });
  });

  test('logs requests denied by role authorization', async () => {
    const securityLogger = jest.fn();
    await request(createApp(securityLogger))
      .get('/api/v1/admin/books')
      .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
      .expect(403);

    expect(securityLogger).toHaveBeenCalledWith(expect.anything(), 'unauthorized_access');
  });

  test('preserves 401 for missing or invalid authentication', async () => {
    const app = createApp();
    await request(app).get('/api/v1/admin/books').expect(401);
    await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  test('rejects an empty required role at initialization', () => {
    expect(() => createRequireRoleMiddleware('')).toThrow('A required role must be provided');
  });
});
