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
  const adminMutations = [];
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
  app.post('/api/v1/admin/books', (req, res) => {
    adminMutations.push({ resource: 'book', body: req.body });
    return res.status(201).json({ created: true });
  });
  app.get('/api/v1/admin/orders', (req, res) => res.json({ orders: [] }));
  app.patch('/api/v1/admin/orders/:id/status', (req, res) => {
    adminMutations.push({ resource: 'order', id: req.params.id, status: req.body.status });
    return res.json({ updated: true });
  });
  app.adminMutations = adminMutations;
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

  test('logs three failed logins and a customer admin denial with safe request metadata', async () => {
    const repo = createUserRepo();
    await repo.create({
      name: 'Reader',
      email: 'reader@example.com',
      password_hash: await bcrypt.hash('correct-password', 4)
    });
    const securityLogger = jest.fn();
    const app = createApp(repo, securityLogger);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reader@example.com', password: 'wrong-password' })
        .expect(401);
    }

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reader@example.com', password: 'correct-password' })
      .expect(200);
    await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', bearer(login.body.token))
      .expect(403);

    expect(securityLogger.mock.calls.map(([, event]) => event)).toEqual([
      'login_failed',
      'login_failed',
      'login_failed',
      'unauthorized_access'
    ]);
    expect(securityLogger.mock.calls[3][0].user).toMatchObject({
      id: 'user-1',
      role: 'CUSTOMER'
    });
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

  test('blocks customer book creation before the admin handler runs', async () => {
    const repo = createUserRepo();
    const registration = await repo.create({
      name: 'Reader',
      email: 'reader@example.com',
      password_hash: await bcrypt.hash('reader-password', 4)
    });
    const securityLogger = jest.fn();
    const app = createApp(repo, securityLogger);
    const token = jwt.sign({ role: 'CUSTOMER' }, JWT_SECRET, {
      subject: registration.id,
      expiresIn: 3600
    });

    await request(app)
      .post('/api/v1/admin/books')
      .set('Authorization', bearer(token))
      .send({ title: 'Forbidden book' })
      .expect(403);
    expect(app.adminMutations).toHaveLength(0);
    expect(securityLogger).toHaveBeenCalledWith(expect.anything(), 'unauthorized_access');
  });

  test('blocks customer order status changes and logs the failed admin access', async () => {
    const repo = createUserRepo();
    await repo.create({
      name: 'Reader',
      email: 'reader@example.com',
      password_hash: await bcrypt.hash('reader-password', 4)
    });
    const securityLogger = jest.fn();
    const app = createApp(repo, securityLogger);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reader@example.com', password: 'reader-password' })
      .expect(200);

    await request(app)
      .patch('/api/v1/admin/orders/order-1/status')
      .set('Authorization', bearer(login.body.token))
      .send({ status: 'SHIPPED' })
      .expect(403);
    expect(app.adminMutations).toHaveLength(0);
    expect(securityLogger).toHaveBeenCalledWith(expect.anything(), 'unauthorized_access');
  });

  test('rejects a token with a tampered admin role on protected admin routes', async () => {
    const app = createApp(createUserRepo());
    const validToken = jwt.sign({ role: 'CUSTOMER' }, JWT_SECRET, {
      subject: 'customer-1',
      expiresIn: 3600
    });
    const [header, payload, signature] = validToken.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claims.role = 'ADMIN_STAFF';
    const tamperedToken = [
      header,
      Buffer.from(JSON.stringify(claims)).toString('base64url'),
      signature
    ].join('.');

    const response = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', bearer(tamperedToken))
      .expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body).not.toHaveProperty('orders');
  });

  test('rejects expired JWTs on protected admin routes without returning data', async () => {
    const app = createApp(createUserRepo());
    const expiredToken = jwt.sign({ role: 'CUSTOMER' }, JWT_SECRET, {
      subject: 'customer-1',
      expiresIn: -1
    });
    const response = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', bearer(expiredToken))
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body).not.toHaveProperty('orders');
  });

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
