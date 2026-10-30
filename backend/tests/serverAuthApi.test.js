const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { mountAuthApi } = require('../../server/authApi');
const { errorHandler } = require('../../server/errorHandler');
const { sanitizeInput } = require('../middleware/sanitizeInput');

const JWT_SECRET = 'test-secret-for-server-auth-api';

function createUserRepo() {
  const users = new Map();
  return {
    async create(user) {
      if (users.has(user.email)) {
        throw Object.assign(new Error('duplicate email'), { duplicate: 'email' });
      }
      const saved = { id: `user-${users.size + 1}`, role: 'CUSTOMER', ...user };
      users.set(saved.email, saved);
      const { password_hash, ...publicUser } = saved;
      return publicUser;
    },
    async findByEmail(email) {
      return users.get(email) || null;
    },
    async createAdmin(email, password) {
      const saved = {
        id: `user-${users.size + 1}`,
        email,
        password_hash: await bcrypt.hash(password, 4),
        role: 'ADMIN_STAFF'
      };
      users.set(email, saved);
      return saved;
    }
  };
}

function createApp(userRepo, securityLogger = () => {}) {
  const app = express();
  app.use(express.json());
  app.use(sanitizeInput);
  mountAuthApi({
    app,
    expressImpl: express,
    jwtSecret: JWT_SECRET,
    bcryptImpl: bcrypt,
    jwtImpl: jwt,
    userRepo,
    securityLogger
  });

  app.get('/api/v1/admin/books', (req, res) => res.json({ books: [] }));
  app.get('/api/v1/admin/orders', (req, res) => res.json({ orders: [] }));
  app.use(errorHandler);
  return app;
}

function bearer(token) {
  return `Bearer ${token}`;
}

describe('server auth API integration', () => {
  test('registers, logs in, and authenticates customer requests', async () => {
    const app = createApp(createUserRepo());
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Reader', email: 'reader@example.com', password: 'bookworm' })
      .expect(201);
    expect(registration.body.user.email).toBe('reader@example.com');
    expect(registration.body.user).not.toHaveProperty('password_hash');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reader@example.com', password: 'bookworm' })
      .expect(200);
    expect(login.body).toMatchObject({ role: 'CUSTOMER', expiresIn: 3600 });

    const response = await request(app)
      .get('/api/v1/admin/books')
      .set('Authorization', bearer(login.body.token))
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('returns the duplicate-email error envelope through the live server handler', async () => {
    const app = createApp(createUserRepo());
    const payload = { name: 'Reader', email: 'reader@example.com', password: 'bookworm' };
    await request(app).post('/api/v1/auth/register').send(payload).expect(201);

    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(409);
    expect(duplicate.body.error.code).toBe('EMAIL_EXISTS');
  });

  test.each(['/api/v1/admin/books', '/api/v1/admin/orders'])(
    'rejects customer requests at every admin path: %s',
    async (path) => {
      const repo = createUserRepo();
      await repo.create({ name: 'Reader', email: 'reader@example.com', password_hash: 'unused' });
      const app = createApp(repo);
      const token = jwt.sign({ role: 'CUSTOMER' }, JWT_SECRET, {
        subject: 'customer-1',
        expiresIn: 3600
      });

      await request(app).get(path).set('Authorization', bearer(token)).expect(403);
    }
  );

  test('allows an authenticated admin account on admin endpoints', async () => {
    const repo = createUserRepo();
    await repo.createAdmin('admin@example.com', 'admin-password');
    const app = createApp(repo);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-password' })
      .expect(200);

    await request(app)
      .get('/api/v1/admin/books')
      .set('Authorization', bearer(login.body.token))
      .expect(200, { books: [] });
  });
});
