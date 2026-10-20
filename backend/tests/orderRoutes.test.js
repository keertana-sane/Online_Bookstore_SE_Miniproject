const request = require('supertest');
const { createOrderService } = require('../services/orderService');
const { createPaymentAdapter } = require('../services/paymentAdapter');
const { createOrderRouter } = require('../routes/orderRoutes');
const { createMockPaymentService } = require('../mock-payment/mockPaymentService');
const {
  createFakeBookRepo,
  createFakeCartRepo,
  createFakeOrderRepo
} = require('./helpers/fakeRepos');
const { createTestApp } = require('./helpers/testApp');

const B1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const AUTH = { Authorization: 'Bearer cust-1' };
const KEY = '11111111-1111-4111-8111-111111111111';
const ADDRESS = '12 MG Road, Bengaluru 560001';

function buildApp(mode = 'success') {
  const bookRepo = createFakeBookRepo([{ id: B1, title: 'Book One', price: 499, stock: 5 }]);
  const cartRepo = createFakeCartRepo();
  const orderRepo = createFakeOrderRepo();
  const paymentAdapter = createPaymentAdapter({
    client: createMockPaymentService({ mode, delayMs: 300 }),
    timeoutMs: 30
  });
  const orderService = createOrderService({ cartRepo, bookRepo, orderRepo, paymentAdapter });
  const app = createTestApp(({ authenticate }) => createOrderRouter({ orderService, authenticate }));
  return { app, cartRepo, orderRepo };
}

const withCart = async (ctx) => ctx.cartRepo.saveItems('cust-1', [{ bookId: B1, quantity: 2 }]);

describe('POST /api/v1/orders (API-09)', () => {
  test('401 without a token', async () => {
    const { app } = buildApp();
    await request(app).post('/api/v1/orders').set('Idempotency-Key', KEY).send({ shippingAddress: ADDRESS }).expect(401);
  });

  test('201 with the documented body; the client total is ignored', async () => {
    const ctx = buildApp();
    await withCart(ctx);
    const res = await request(ctx.app)
      .post('/api/v1/orders')
      .set(AUTH)
      .set('Idempotency-Key', KEY)
      .send({ shippingAddress: ADDRESS, total: 1 }) // tampered total must not matter
      .expect(201);

    expect(res.body).toMatchObject({
      orderStatus: 'PLACED',
      paymentStatus: 'SUCCESS',
      total: 998,
      items: [{ bookId: B1, title: 'Book One', quantity: 2, unitPrice: 499 }]
    });
    expect(res.body.orderId).toBeDefined();
    expect(res.body.orderNumber).toMatch(/^ORD-/);
    expect(res.body.createdAt).toBeDefined();
  });

  test('200 replay with the same key returns the same order', async () => {
    const ctx = buildApp();
    await withCart(ctx);
    const send = () =>
      request(ctx.app).post('/api/v1/orders').set(AUTH).set('Idempotency-Key', KEY).send({ shippingAddress: ADDRESS });
    const first = await send().expect(201);
    const second = await send().expect(200);
    expect(second.body.orderNumber).toBe(first.body.orderNumber);
    expect(ctx.orderRepo.orders).toHaveLength(1);
  });

  test('422 for a missing Idempotency-Key, bad address and empty cart', async () => {
    const ctx = buildApp();
    await withCart(ctx);
    let res = await request(ctx.app).post('/api/v1/orders').set(AUTH).send({ shippingAddress: ADDRESS }).expect(422);
    expect(res.body.error.details[0].field).toBe('Idempotency-Key');

    res = await request(ctx.app).post('/api/v1/orders').set(AUTH).set('Idempotency-Key', KEY).send({}).expect(422);
    expect(res.body.error.details[0].field).toBe('shippingAddress');

    const empty = buildApp();
    res = await request(empty.app).post('/api/v1/orders').set(AUTH).set('Idempotency-Key', KEY).send({ shippingAddress: ADDRESS }).expect(422);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  test('402 when payment is declined, 504 when it times out', async () => {
    const declined = buildApp('decline');
    await withCart(declined);
    let res = await request(declined.app).post('/api/v1/orders').set(AUTH).set('Idempotency-Key', KEY).send({ shippingAddress: ADDRESS }).expect(402);
    expect(res.body.error.code).toBe('PAYMENT_DECLINED');

    const slow = buildApp('timeout');
    await withCart(slow);
    res = await request(slow.app).post('/api/v1/orders').set(AUTH).set('Idempotency-Key', KEY).send({ shippingAddress: ADDRESS }).expect(504);
    expect(res.body.error.code).toBe('PAYMENT_TIMEOUT');
  });

  test('409 OUT_OF_STOCK lists the book ids', async () => {
    const ctx = buildApp();
    await ctx.cartRepo.saveItems('cust-1', [{ bookId: B1, quantity: 99 }]);
    const res = await request(ctx.app).post('/api/v1/orders').set(AUTH).set('Idempotency-Key', KEY).send({ shippingAddress: ADDRESS }).expect(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
    expect(res.body.error.details[0].bookId).toBe(B1);
  });
});
