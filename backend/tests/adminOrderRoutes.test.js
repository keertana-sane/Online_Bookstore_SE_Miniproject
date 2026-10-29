const express = require('express');
const request = require('supertest');
const AppError = require('../utils/AppError');
const { createOrderService } = require('../services/orderService');
const { createPaymentAdapter } = require('../services/paymentAdapter');
const { createMockPaymentService } = require('../mock-payment/mockPaymentService');
const { createAdminOrderRouter } = require('../routes/adminOrderRoutes');
const { createRequireRoleMiddleware } = require('../middleware/requireRole');
const { createFakeBookRepo, createFakeCartRepo, createFakeOrderRepo } = require('./helpers/fakeRepos');

const CUSTOMER = 'cust-1';
const ADMIN = 'admin-1';
const BOOK = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const ADDRESS = '12 MG Road, Bengaluru 560001';

function setup() {
  const bookRepo = createFakeBookRepo([{ id: BOOK, title: 'Book One', price: 499, stock: 10 }]);
  const cartRepo = createFakeCartRepo();
  const orderRepo = createFakeOrderRepo();
  const paymentAdapter = createPaymentAdapter({
    client: createMockPaymentService({ mode: 'success', delayMs: 0 }),
    timeoutMs: 30
  });
  const orderService = createOrderService({ cartRepo, bookRepo, orderRepo, paymentAdapter });

  function authenticate(req, res, next) {
    const header = req.get('authorization');
    if (!header) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    const role = header.includes('admin') ? 'ADMIN_STAFF' : 'CUSTOMER';
    req.user = { id: header.includes('admin') ? ADMIN : CUSTOMER, role };
    next();
  }
  const requireAdmin = createRequireRoleMiddleware('ADMIN_STAFF');
  const authenticateAdmin = (req, res, next) => authenticate(req, res, (err) => {
    if (err) return next(err);
    return requireAdmin(req, res, next);
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', createAdminOrderRouter({ orderService, authenticate: authenticateAdmin }));
  app.use((err, req, res, _next) => {
    if (err instanceof AppError || err.status) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });

  return { app, bookRepo, cartRepo, orderRepo, orderService };
}

async function placeOrder(ctx) {
  await ctx.cartRepo.saveItems(CUSTOMER, [{ bookId: BOOK, quantity: 1 }]);
  return ctx.orderService.placeOrder(CUSTOMER, {
    shippingAddress: ADDRESS,
    idempotencyKey: '11111111-1111-4111-8111-111111111111'
  }).then((result) => result.order);
}

const admin = { Authorization: 'Bearer admin-token' };
const customer = { Authorization: 'Bearer customer-token' };

describe('admin order API (FR-015)', () => {
  test('lists confirmed orders and filters by status', async () => {
    const ctx = setup();
    const placed = await placeOrder(ctx);

    const all = await request(ctx.app).get('/api/v1/admin/orders').set(admin).expect(200);
    expect(all.body.orders).toHaveLength(1);
    expect(all.body.orders[0].orderId).toBe(placed.orderId);

    await request(ctx.app).get('/api/v1/admin/orders?status=SHIPPED').set(admin).expect(200);
    const filtered = await request(ctx.app).get('/api/v1/admin/orders?status=PLACED').set(admin).expect(200);
    expect(filtered.body.orders).toHaveLength(1);
  });

  test('admin can update status and history contains previous status, new status, actor and time', async () => {
    const ctx = setup();
    const placed = await placeOrder(ctx);

    const response = await request(ctx.app)
      .patch(`/api/v1/admin/orders/${placed.orderId}/status`)
      .set(admin)
      .send({ status: 'PROCESSING', actor: 'client-supplied' })
      .expect(200);

    expect(response.body.orderStatus).toBe('PROCESSING');
    expect(response.body.statusHistory.at(-1)).toMatchObject({
      status: 'PROCESSING',
      previousStatus: 'PLACED',
      newStatus: 'PROCESSING',
      at: expect.any(String),
      by: 'staff'
    });
    expect(ctx.orderRepo.orders[0].statusHistory.at(-1)).toMatchObject({
      previousStatus: 'PLACED',
      newStatus: 'PROCESSING',
      actor: ADMIN
    });
    expect(ctx.orderRepo.orders[0].statusHistory.at(-1).actor).not.toBe('client-supplied');
    expect(ctx.orderRepo.orders[0].statusHistory.at(-1).at).toBeInstanceOf(Date);
  });

  test('rejects invalid transitions with HTTP 409', async () => {
    const ctx = setup();
    const placed = await placeOrder(ctx);
    ctx.orderRepo.orders[0].orderStatus = 'SHIPPED';

    const response = await request(ctx.app)
      .patch(`/api/v1/admin/orders/${placed.orderId}/status`)
      .set(admin)
      .send({ status: 'PROCESSING' })
      .expect(409);

    expect(response.body.error.code).toBe('INVALID_ORDER_STATUS_TRANSITION');
  });

  test('rejects invalid status values', async () => {
    const ctx = setup();
    const placed = await placeOrder(ctx);
    await request(ctx.app)
      .patch(`/api/v1/admin/orders/${placed.orderId}/status`)
      .set(admin)
      .send({ status: 'SHIPPING' })
      .expect(422);
  });

  test('customers cannot access admin endpoints', async () => {
    const ctx = setup();
    await request(ctx.app).get('/api/v1/admin/orders').set(customer).expect(403);
    await request(ctx.app)
      .patch('/api/v1/admin/orders/aaaaaaaaaaaaaaaaaaaaaaaa/status')
      .set(customer)
      .send({ status: 'PROCESSING' })
      .expect(403);
  });

  test('returns 404 for a missing order', async () => {
    const ctx = setup();
    await request(ctx.app)
      .patch('/api/v1/admin/orders/aaaaaaaaaaaaaaaaaaaaaaaa/status')
      .set(admin)
      .send({ status: 'PROCESSING' })
      .expect(404);
  });

  test('unauthenticated requests return 401', async () => {
    const ctx = setup();
    await request(ctx.app).get('/api/v1/admin/orders').expect(401);
    await request(ctx.app)
      .patch('/api/v1/admin/orders/aaaaaaaaaaaaaaaaaaaaaaaa/status')
      .send({ status: 'PROCESSING' })
      .expect(401);
  });

  test('rejects missing, empty, and malformed status payloads', async () => {
    const ctx = setup();
    const placed = await placeOrder(ctx);
    const url = `/api/v1/admin/orders/${placed.orderId}/status`;

    await request(ctx.app).patch(url).set(admin).expect(422);
    await request(ctx.app).patch(url).set(admin).send({ status: '' }).expect(422);
    await request(ctx.app).patch(url).set(admin).send({ status: null }).expect(422);
    await request(ctx.app).patch(url).set(admin).send({ status: { value: 'PROCESSING' } }).expect(422);
  });

  test('rejects invalid order ids before repository lookup', async () => {
    const ctx = setup();
    await request(ctx.app)
      .patch('/api/v1/admin/orders/not-an-object-id/status')
      .set(admin)
      .send({ status: 'PROCESSING' })
      .expect(422);
  });

  test('rejects invalid status filters', async () => {
    const ctx = setup();
    const response = await request(ctx.app)
      .get('/api/v1/admin/orders?status=SHIPPING')
      .set(admin)
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('supports the documented forward lifecycle transitions', async () => {
    const ctx = setup();
    const placed = await placeOrder(ctx);
    let url = `/api/v1/admin/orders/${placed.orderId}/status`;

    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const response = await request(ctx.app).patch(url).set(admin).send({ status }).expect(200);
      expect(response.body.orderStatus).toBe(status);
    }

    expect(ctx.orderRepo.orders[0].statusHistory.at(-1)).toMatchObject({
      previousStatus: 'SHIPPED',
      newStatus: 'DELIVERED',
      actor: ADMIN
    });
  });

  test('customer cannot list or filter admin orders, including malformed queries', async () => {
    const ctx = setup();
    await request(ctx.app).get('/api/v1/admin/orders').set(customer).expect(403);
    await request(ctx.app).get('/api/v1/admin/orders?status=SHIPPING').set(customer).expect(403);
  });
});