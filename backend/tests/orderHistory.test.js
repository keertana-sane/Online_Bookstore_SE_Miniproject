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

const A = 'cust-a';
const B = 'cust-b';
const B1 = 'aaaaaaaaaaaaaaaaaaaaaaa1'; // 499.00
const B2 = 'aaaaaaaaaaaaaaaaaaaaaaa2'; // 250.50
const ADDRESS = '12 MG Road, Bengaluru 560001';
const key = (n) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;

function setup({ mode = 'success' } = {}) {
  const bookRepo = createFakeBookRepo([
    { id: B1, title: 'Book One', price: 499.0, stock: 10 },
    { id: B2, title: 'Book Two', price: 250.5, stock: 10 }
  ]);
  const cartRepo = createFakeCartRepo();
  const orderRepo = createFakeOrderRepo();
  const paymentAdapter = createPaymentAdapter({
    client: createMockPaymentService({ mode, delayMs: 0 }),
    timeoutMs: 30
  });
  const service = createOrderService({ cartRepo, bookRepo, orderRepo, paymentAdapter });
  const app = createTestApp(({ authenticate }) =>
    createOrderRouter({ orderService: service, authenticate })
  );

  async function order(customer, n, items = [{ bookId: B1, quantity: 2 }]) {
    await cartRepo.saveItems(customer, items);
    const { order: placed } = await service.placeOrder(customer, {
      shippingAddress: ADDRESS,
      idempotencyKey: key(n)
    });
    return placed;
  }

  return { service, app, bookRepo, cartRepo, orderRepo, order };
}

describe('order history (FR-012, TC-TRK-01, TC-TRK-07)', () => {
  test('lists only the customer\'s own orders, newest first, each with a status', async () => {
    const { service, order } = setup();
    const first = await order(A, 1);
    const second = await order(A, 2, [{ bookId: B2, quantity: 1 }]);
    const third = await order(A, 3);
    await order(B, 4); // someone else's order must not appear

    const { orders } = await service.listOrders(A);

    expect(orders.map((o) => o.orderId)).toEqual([third.orderId, second.orderId, first.orderId]);
    expect(orders[0]).toMatchObject({
      orderNumber: third.orderNumber,
      orderStatus: 'PLACED',
      paymentStatus: 'SUCCESS',
      total: 998,
      itemCount: 2
    });
    expect(orders[1]).toMatchObject({ total: 250.5, itemCount: 1 });
  });

  test('a customer with no orders gets an empty list, not an error', async () => {
    const { service } = setup();
    expect(await service.listOrders(A)).toEqual({ orders: [] });
  });

  test('a declined payment is never shown as an order', async () => {
    const { service, cartRepo, orderRepo } = setup({ mode: 'decline' });
    await cartRepo.saveItems(A, [{ bookId: B1, quantity: 1 }]);
    await expect(
      service.placeOrder(A, { shippingAddress: ADDRESS, idempotencyKey: key(1) })
    ).rejects.toMatchObject({ code: 'PAYMENT_DECLINED' });

    expect(orderRepo.orders).toHaveLength(1); // kept for the record (SAD 4.4)
    expect(await service.listOrders(A)).toEqual({ orders: [] });
    await expect(service.getOrder(A, orderRepo.orders[0].id)).rejects.toMatchObject({
      status: 404,
      code: 'ORDER_NOT_FOUND'
    });
  });
});

describe('order detail (TC-TRK-02, TC-TRK-03)', () => {
  test('returns items, total, status, address and statusHistory', async () => {
    const { service, order } = setup();
    const placed = await order(A, 1, [
      { bookId: B1, quantity: 2 },
      { bookId: B2, quantity: 1 }
    ]);

    const detail = await service.getOrder(A, placed.orderId);

    expect(detail).toMatchObject({
      orderId: placed.orderId,
      orderNumber: placed.orderNumber,
      orderStatus: 'PLACED',
      paymentStatus: 'SUCCESS',
      total: 1248.5,
      shippingAddress: ADDRESS
    });
    expect(detail.items).toEqual([
      { bookId: B1, title: 'Book One', quantity: 2, unitPrice: 499 },
      { bookId: B2, title: 'Book Two', quantity: 1, unitPrice: 250.5 }
    ]);
    expect(detail.statusHistory).toEqual([
      { status: 'PLACED', at: expect.any(Date), by: 'you' }
    ]);
  });

  test('another customer\'s order is 404 ORDER_NOT_FOUND and leaks nothing', async () => {
    const { service, order } = setup();
    const bs = await order(B, 1);

    const err = await service.getOrder(A, bs.orderId).catch((e) => e);
    expect(err).toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' });
    expect(JSON.stringify(err)).not.toContain(bs.orderNumber);
  });

  test('an unknown order id is 404', async () => {
    const { service } = setup();
    await expect(service.getOrder(A, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('cancel order (SRS 6.5, TC-TRK-05, TC-TRK-06)', () => {
  test('cancels a PLACED order, records it and restores the stock', async () => {
    const { service, order, bookRepo } = setup();
    const placed = await order(A, 1, [
      { bookId: B1, quantity: 2 },
      { bookId: B2, quantity: 1 }
    ]);
    expect(bookRepo.store.get(B1).stock).toBe(8);
    expect(bookRepo.store.get(B2).stock).toBe(9);

    const cancelled = await service.cancelOrder(A, placed.orderId);

    expect(cancelled.orderStatus).toBe('CANCELLED');
    expect(cancelled.statusHistory.map((h) => [h.status, h.by])).toEqual([
      ['PLACED', 'you'],
      ['CANCELLED', 'you']
    ]);
    expect(bookRepo.store.get(B1).stock).toBe(10);
    expect(bookRepo.store.get(B2).stock).toBe(10);
    expect((await service.getOrder(A, placed.orderId)).orderStatus).toBe('CANCELLED');
  });

  test.each(['PROCESSING', 'SHIPPED', 'DELIVERED'])(
    '409 CANCEL_NOT_ALLOWED once the order is %s, and nothing changes',
    async (status) => {
      const { service, order, orderRepo, bookRepo } = setup();
      const placed = await order(A, 1);
      orderRepo.orders[0].orderStatus = status; // staff moved it on

      await expect(service.cancelOrder(A, placed.orderId)).rejects.toMatchObject({
        status: 409,
        code: 'CANCEL_NOT_ALLOWED'
      });
      expect(orderRepo.orders[0].orderStatus).toBe(status);
      expect(bookRepo.store.get(B1).stock).toBe(8); // not restored
    }
  );

  test('cancelling twice restores the stock only once', async () => {
    const { service, order, bookRepo } = setup();
    const placed = await order(A, 1);

    await service.cancelOrder(A, placed.orderId);
    await expect(service.cancelOrder(A, placed.orderId)).rejects.toMatchObject({
      code: 'CANCEL_NOT_ALLOWED'
    });
    expect(bookRepo.store.get(B1).stock).toBe(10); // not 12
  });

  test('two cancels at the same moment restore the stock only once', async () => {
    const { service, order, bookRepo } = setup();
    const placed = await order(A, 1);

    const results = await Promise.allSettled([
      service.cancelOrder(A, placed.orderId),
      service.cancelOrder(A, placed.orderId)
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(bookRepo.store.get(B1).stock).toBe(10);
  });

  test('cannot cancel someone else\'s order', async () => {
    const { service, order, orderRepo } = setup();
    const bs = await order(B, 1);

    await expect(service.cancelOrder(A, bs.orderId)).rejects.toMatchObject({
      status: 404,
      code: 'ORDER_NOT_FOUND'
    });
    expect(orderRepo.orders[0].orderStatus).toBe('PLACED');
  });
});

describe('HTTP: /api/v1/orders (API-10, API-11, API-12)', () => {
  const as = (customer) => ({ Authorization: `Bearer ${customer}` });

  test.each([
    ['get', '/api/v1/orders'],
    ['get', '/api/v1/orders/some-id'],
    ['patch', '/api/v1/orders/some-id/cancel']
  ])('401 UNAUTHORIZED without a token: %s %s (TC-TRK-08)', async (method, url) => {
    const { app } = setup();
    const res = await request(app)[method](url).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('GET /orders returns 200 with an empty list for a new customer', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/v1/orders').set(as(A)).expect(200);
    expect(res.body).toEqual({ orders: [] });
  });

  test('history, detail and cancel work end to end', async () => {
    const { app, order } = setup();
    const placed = await order(A, 1);

    const list = await request(app).get('/api/v1/orders').set(as(A)).expect(200);
    expect(list.body.orders).toHaveLength(1);

    const detail = await request(app).get(`/api/v1/orders/${placed.orderId}`).set(as(A)).expect(200);
    expect(detail.body).toMatchObject({ orderNumber: placed.orderNumber, orderStatus: 'PLACED' });

    const cancelled = await request(app)
      .patch(`/api/v1/orders/${placed.orderId}/cancel`)
      .set(as(A))
      .expect(200);
    expect(cancelled.body.orderStatus).toBe('CANCELLED');

    const again = await request(app)
      .patch(`/api/v1/orders/${placed.orderId}/cancel`)
      .set(as(A))
      .expect(409);
    expect(again.body.error.code).toBe('CANCEL_NOT_ALLOWED');
  });

  test('another customer\'s order is 404 ORDER_NOT_FOUND for detail and cancel', async () => {
    const { app, order } = setup();
    const bs = await order(B, 1);

    const detail = await request(app).get(`/api/v1/orders/${bs.orderId}`).set(as(A)).expect(404);
    expect(detail.body.error.code).toBe('ORDER_NOT_FOUND');
    expect(JSON.stringify(detail.body)).not.toContain(bs.orderNumber);

    await request(app).patch(`/api/v1/orders/${bs.orderId}/cancel`).set(as(A)).expect(404);
  });
});
