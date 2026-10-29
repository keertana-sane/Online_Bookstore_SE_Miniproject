const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const { createAuthService } = require('../services/authService');
const { createAuthRouter } = require('../routes/authRoutes');
const userRepo = require('../repositories/userRepository');
const { createUserModel } = require('../models/User');
const authModule = require('../routes/authModule');
const AppError = require('../utils/AppError');
const { sanitizeInput } = require('../middleware/sanitizeInput');
const { createLoginRateLimiter } = require('../middleware/loginRateLimit');
const User = createUserModel();

const JWT_SECRET = 'test-secret-for-jwt-signing';

function createApp(userRepo, options = {}) {
  const app = express();
  app.use(express.json());
  app.use(sanitizeInput);
  app.use('/api/v1', createAuthRouter({
    authService: createAuthService({ userRepo, jwtSecret: JWT_SECRET }),
    ...options
  }));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details }
      });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  });
  return app;
}

function createFakeUserRepo() {
  const users = new Map();
  return {
    users,
    async create(data) {
      if (users.has(data.email)) {
        throw Object.assign(new Error('duplicate email'), { duplicate: 'email' });
      }
      const user = {
        id: String(users.size + 1),
        name: data.name,
        email: data.email,
        role: 'CUSTOMER'
      };
      users.set(data.email, { ...data, ...user });
      return user;
    },
    async findByEmail(email) {
      const user = users.get(email);
      return user ? { ...user } : null;
    }
  };
}

describe('POST /api/v1/auth/register', () => {
  test('creates an account with a 60-character bcrypt hash and returns 201', async () => {
    const userRepo = createFakeUserRepo();
    const app = createApp(userRepo);
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: '  Pat Reader ', email: ' PAT@example.com ', password: 'bookworm' })
      .expect(201);

    expect(response.body.user).toMatchObject({
      id: '1',
      name: 'Pat Reader',
      email: 'pat@example.com',
      role: 'CUSTOMER'
    });
    expect(response.body.user).not.toHaveProperty('password_hash');
    const saved = userRepo.users.get('pat@example.com');
    expect(saved.password_hash).toHaveLength(60);
    expect(await bcrypt.compare('bookworm', saved.password_hash)).toBe(true);
  });

  test('returns 409 EMAIL_EXISTS for a duplicate email, regardless of case', async () => {
    const app = createApp(createFakeUserRepo());
    const payload = { name: 'Pat Reader', email: 'pat@example.com', password: 'bookworm' };
    await request(app).post('/api/v1/auth/register').send(payload).expect(201);

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...payload, email: 'PAT@example.com' })
      .expect(409);
    expect(response.body.error.code).toBe('EMAIL_EXISTS');
  });

  test('rejects passwords shorter than 8 characters and malformed input', async () => {
    const app = createApp(createFakeUserRepo());
    const shortPassword = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Pat Reader', email: 'pat@example.com', password: 'short7' })
      .expect(422);
    expect(shortPassword.body.error.details[0].field).toBe('password');

    const invalidEmail = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Pat Reader', email: 'not-an-email', password: 'bookworm' })
      .expect(422);
    expect(invalidEmail.body.error.details[0].field).toBe('email');
  });

  test.each([
    [{ name: 'x'.repeat(101), email: 'pat@example.com', password: 'bookworm' }, 'name'],
    [{ name: 'Pat Reader', email: 'x'.repeat(90) + '@example.com', password: 'bookworm' }, 'email'],
    [{ name: 'Pat Reader', email: 'pat@example.com', password: 'p'.repeat(73) }, 'password'],
    [{ name: '<script>alert(1)</script>', email: 'pat@example.com', password: 'bookworm' }, 'name']
  ])('rejects invalid limits and markup (%s)', async (payload, field) => {
    const response = await request(createApp(createFakeUserRepo()))
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(422);
    expect(response.body.error.details[0].field).toBe(field);
  });

  test('operator-shaped registration values are removed and rejected', async () => {
    const response = await request(createApp(createFakeUserRepo()))
      .post('/api/v1/auth/register')
      .send({ name: 'Pat Reader', email: { $gt: '' }, password: 'bookworm' })
      .expect(422);
    expect(response.body.error.details[0].field).toBe('email');
  });
});

describe('POST /api/v1/auth/login', () => {
  test('returns a one-hour JWT containing the user id and role', async () => {
    const userRepo = createFakeUserRepo();
    const app = createApp(userRepo);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Pat Reader', email: 'pat@example.com', password: 'bookworm' })
      .expect(201);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ' PAT@example.com ', password: 'bookworm' })
      .expect(200);

    expect(response.body).toMatchObject({ role: 'CUSTOMER', expiresIn: 3600 });
    const claims = jwt.verify(response.body.token, JWT_SECRET);
    expect(claims).toMatchObject({ sub: '1', role: 'CUSTOMER' });
    expect(claims.exp - claims.iat).toBe(3600);
  });

  test.each([
    { email: 'unknown@example.com', password: 'bookworm' },
    { email: 'pat@example.com', password: 'wrongpass' },
    { email: 'not-an-email', password: 'bookworm' },
    {}
  ])('returns the same generic 401 for invalid credentials: %p', async (credentials) => {
    const userRepo = createFakeUserRepo();
    const app = createApp(userRepo);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Pat Reader', email: 'pat@example.com', password: 'bookworm' })
      .expect(201);

    const response = await request(app).post('/api/v1/auth/login').send(credentials).expect(401);
    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    });
  });

  test('returns 429 on the 11th login attempt within 15 minutes', async () => {
    const securityLogger = jest.fn();
    const app = createApp(createFakeUserRepo(), {
      securityLogger,
      loginRateLimiter: createLoginRateLimiter({ onLimit: securityLogger })
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'bookworm' })
        .expect(401);
    }

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.com', password: 'bookworm' })
      .expect(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(securityLogger).toHaveBeenCalledWith(expect.anything(), 'login_rate_limited');
    expect(securityLogger).toHaveBeenCalledWith(expect.anything(), 'login_failed');
  });
});

describe('userRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  test('uses a unique email index and translates Mongo duplicate errors', async () => {
    expect(User.schema.path('email').options.unique).toBe(true);
    jest.spyOn(User, 'create').mockRejectedValueOnce({
      code: 11000,
      keyPattern: { email: 1 }
    });

    await expect(
      userRepo.create({ name: 'Pat Reader', email: 'pat@example.com', password_hash: 'hash' })
    ).rejects.toMatchObject({ duplicate: 'email' });
  });

  test('fails fast if JWT_SECRET is missing', () => {
    expect(() => authModule.createAuthModule({ jwtSecret: '' })).toThrow('JWT_SECRET must be set');
  });

  test('finds users by normalized email and includes the password hash for verification', async () => {
    const doc = {
      _id: 'user-id',
      name: 'Pat Reader',
      email: 'pat@example.com',
      role: 'CUSTOMER',
      password_hash: 'bcrypt-hash'
    };
    jest.spyOn(User, 'findOne').mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(doc) });

    await expect(userRepo.findByEmail('pat@example.com')).resolves.toEqual({
      id: 'user-id',
      name: 'Pat Reader',
      email: 'pat@example.com',
      role: 'CUSTOMER',
      password_hash: 'bcrypt-hash'
    });
    expect(User.findOne).toHaveBeenCalledWith({ email: 'pat@example.com' });
  });
});
