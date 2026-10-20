const { createOrderService } = require('../services/orderService');
const { createPaymentAdapter } = require('../services/paymentAdapter');
const { createMockPaymentService } = require('../mock-payment/mockPaymentService');
const {
  createFakeBookRepo,
  createFakeCartRepo,
  createFakeOrderRepo
} = require('./helpers/fakeRepos');

const CUSTOMER = 'cust-1';
const B1 = 'aaaaaaaaaaaaaaaaaaaaaaa1'; // 499.00, stock 5
const B2 = 'aaaaaaaaaaaaaaaaaaaaaaa2'; // 250.50, stock 3
const KEY = '11111111-1111-4111-8111-111111111111';
const KEY2 = '22222222-2222-4222-8222-222222222222';
const ADDRESS = '12 MG Road, Bengaluru 560001';

function setup({ mode = 'success', delayMs = 300, timeoutMs = 30, client, orderOptions = {} } = {}) {
  const bookRepo = createFakeBookRepo([
    { id: B1, title: 'Book One', price: 499.0, stock: 5 },
    { id: B2, title: 'Book Two', price: 250.5, stock: 3 }
  ]);
  const cartRepo = createFakeCartRepo();
  const orderRepo = createFakeOrderRepo();
  const mock = client || createMockPaymentService({ mode, delayMs });
  const paymentAdapter = createPaymentAdapter({ client: mock, timeoutMs });
  const service = createOrderService({
    cartRepo, bookRepo, orderRepo, paymentAdapter, ...orderOptions
  });
  return { service, bookRepo, cartRepo, orderRepo, mock };
}

const fillCart = (cartRepo, customer = CUSTOMER) =>
  cartRepo.saveItems(customer, [
    { bookId: B1, quantity: 2 },
    { bookId: B2, quantity: 1 }
  ]);

const place = (service, overrides = {}) =>
  service.placeOrder(CUSTOMER, { shippingAddress: ADDRESS, idempotencyKey: KEY, ...overrides });

const rejects = async (promise, status, code) => {
  await expect(promise).rejects.toMatchObject({ status, code });
};

describe('checkout - success (FR-009, FR-010, FR-016, TC-ORD)', () => {
  test('creates a PLACED order with payment SUCCESS and the recomputed total', async () => {
    const { service, cartRepo, orderRepo, bookRepo } = setup();
    await fillCart(cartRepo);

    const { order, replayed } = await place(service);

    expect(replayed).toBe(false);
    expect(order).toMatchObject({ orderStatus: 'PLACED', paymentStatus: 'SUCCESS', total: 1248.5 });
    expect(order.items).toEqual([
      { bookId: B1, title: 'Book One', quantity: 2, unitPrice: 499 },
      { bookId: B2, title: 'Book Two', quantity: 1, unitPrice: 250.5 }
    ]);
    expect(orderRepo.orders).toHaveLength(1);
    expect(orderRepo.orders[0].statusHistory[0]).toMatchObject({ status: 'PLACED', actor: CUSTOMER });
    expect(bookRepo.store.get(B1).stock).toBe(3); // stock reserved
    expect(bookRepo.store.get(B2).stock).toBe(2);
    expect((await cartRepo.findByCustomerId(CUSTOMER)).items).toEqual([]); // cart cleared
  });

  test('order numbers are unique (different customers, different numbers)', async () => {
    const { service, cartRepo } = setup();
    await fillCart(cartRepo, 'cust-1');
    await cartRepo.saveItems('cust-2', [{ bookId: B1, quantity: 1 }]);
    const a = await service.placeOrder('cust-1', { shippingAddress: ADDRESS, idempotencyKey: KEY });
    const b = await service.placeOrder('cust-2', { shippingAddress: ADDRESS, idempotencyKey: KEY2 });
    expect(a.order.orderNumber).toMatch(/^ORD-\d{8}-[0-9A-F]{8}$/);
    expect(a.order.orderNumber).not.toBe(b.order.orderNumber);
  });

  test('an order-number collision picks another number', async () => {
    const numbers = ['ORD-X', 'ORD-X', 'ORD-Y'];
    const { service, cartRepo, orderRepo } = setup({
      orderOptions: { generateOrderNumber: () => numbers.shift() }
    });
    await fillCart(cartRepo, 'cust-1');
    await cartRepo.saveItems('cust-2', [{ bookId: B1, quantity: 1 }]);
    await service.placeOrder('cust-1', { shippingAddress: ADDRESS, idempotencyKey: KEY });
    const second = await service.placeOrder('cust-2', { shippingAddress: ADDRESS, idempotencyKey: KEY2 });
    expect(second.order.orderNumber).toBe('ORD-Y');
    expect(orderRepo.orders).toHaveLength(2);
  });
});

describe('checkout - validation (FR-009)', () => {
  test('empty or missing cart gives 422 CART_EMPTY and creates nothing', async () => {
    const { service, orderRepo, cartRepo } = setup();
    await rejects(place(service), 422, 'CART_EMPTY');
    await cartRepo.saveItems(CUSTOMER, []);
    await rejects(place(service), 422, 'CART_EMPTY');
    expect(orderRepo.orders).toHaveLength(0);
  });

  test.each([undefined, null, '', '   ', 42, 'x'.repeat(301)])(
    'invalid shipping address %p gives 422',
    async (address) => {
      const { service, cartRepo, orderRepo } = setup();
      await fillCart(cartRepo);
      await rejects(place(service, { shippingAddress: address }), 422, 'VALIDATION_ERROR');
      expect(orderRepo.orders).toHaveLength(0);
    }
  );

  test('boundary: a 300 character address is accepted', async () => {
    const { service, cartRepo } = setup();
    await fillCart(cartRepo);
    const { order } = await place(service, { shippingAddress: 'x'.repeat(300) });
    expect(order.orderStatus).toBe('PLACED');
  });

  test.each([undefined, '', 'not-a-uuid', 12345])('invalid Idempotency-Key %p gives 422', async (key) => {
    const { service, cartRepo } = setup();
    await fillCart(cartRepo);
    await rejects(place(service, { idempotencyKey: key }), 422, 'VALIDATION_ERROR');
  });
});

describe('checkout - stock (SRS 6.5: only in-stock books)', () => {
  test('book sold out since it was added gives 409 and changes nothing', async () => {
    const { service, cartRepo, bookRepo, orderRepo } = setup();
    await fillCart(cartRepo);
    bookRepo.store.get(B2).stock = 0;

    const err = await place(service).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'OUT_OF_STOCK' });
    expect(err.details.map((d) => d.bookId)).toEqual([B2]);
    expect(orderRepo.orders).toHaveLength(0);
    expect(bookRepo.store.get(B1).stock).toBe(5); // nothing reserved
    expect((await cartRepo.findByCustomerId(CUSTOMER)).items).toHaveLength(2); // cart kept
  });

  test('disabled book gives 409', async () => {
    const { service, cartRepo, bookRepo } = setup();
    await fillCart(cartRepo);
    bookRepo.store.get(B1).isActive = false;
    await rejects(place(service), 409, 'OUT_OF_STOCK');
  });

  test('if the last copies are taken during checkout, earlier reservations are released', async () => {
    const { service, cartRepo, bookRepo, orderRepo } = setup();
    await fillCart(cartRepo);
    const realReserve = bookRepo.reserveStock.bind(bookRepo);
    bookRepo.reserveStock = async (id, qty) => (id === B2 ? false : realReserve(id, qty));

    await rejects(place(service), 409, 'OUT_OF_STOCK');
    expect(bookRepo.store.get(B1).stock).toBe(5); // B1 reservation rolled back
    expect(orderRepo.orders).toHaveLength(0);
  });
});

describe('checkout - payment failure (FR-016, SRS 6.5)', () => {
  test('declined: 402, no confirmed order, stock restored, cart kept', async () => {
    const { service, cartRepo, bookRepo, orderRepo } = setup({ mode: 'decline' });
    await fillCart(cartRepo);

    await rejects(place(service), 402, 'PAYMENT_DECLINED');

    // SAD 4.4: a declined payment is kept as CANCELLED with paymentStatus FAILED
    expect(orderRepo.orders).toHaveLength(1);
    expect(orderRepo.orders[0]).toMatchObject({ orderStatus: 'CANCELLED', paymentStatus: 'FAILED' });
    expect(orderRepo.orders.filter((o) => o.orderStatus === 'PLACED')).toHaveLength(0);
    expect(bookRepo.store.get(B1).stock).toBe(5);
    expect(bookRepo.store.get(B2).stock).toBe(3);
    expect((await cartRepo.findByCustomerId(CUSTOMER)).items).toHaveLength(2);
  });

  test('retrying a declined payment with the same key gives 402 again, no second record', async () => {
    const { service, cartRepo, orderRepo } = setup({ mode: 'decline' });
    await fillCart(cartRepo);
    await rejects(place(service), 402, 'PAYMENT_DECLINED');
    await rejects(place(service), 402, 'PAYMENT_DECLINED');
    expect(orderRepo.orders).toHaveLength(1);
  });

  test('an unexpected answer from the payment service never confirms an order', async () => {
    const client = { charge: async () => ({ status: 'OK' }), lookup: async () => null };
    const { service, cartRepo, orderRepo } = setup({ client });
    await fillCart(cartRepo);
    await rejects(place(service), 402, 'PAYMENT_DECLINED');
    expect(orderRepo.orders.filter((o) => o.orderStatus === 'PLACED')).toHaveLength(0);
  });

  test('timeout: 504, no order, stock released, cart kept', async () => {
    const { service, cartRepo, bookRepo, orderRepo } = setup({ mode: 'timeout' });
    await fillCart(cartRepo);

    await rejects(place(service), 504, 'PAYMENT_TIMEOUT');

    expect(orderRepo.orders).toHaveLength(0);
    expect(bookRepo.store.get(B1).stock).toBe(5);
    expect((await cartRepo.findByCustomerId(CUSTOMER)).items).toHaveLength(2);
  });
});

describe('checkout - retries never create a second order (NFR-004, TC-TST)', () => {
  test('timeout, then retry with the same key: exactly one order and one payment', async () => {
    const { service, cartRepo, bookRepo, orderRepo, mock } = setup({ mode: 'timeout-once' });
    await fillCart(cartRepo);

    await rejects(place(service), 504, 'PAYMENT_TIMEOUT');
    expect(orderRepo.orders).toHaveLength(0);
    expect(bookRepo.store.get(B1).stock).toBe(5);

    const { order, replayed } = await place(service); // same key: retry
    expect(replayed).toBe(false);
    expect(order.orderStatus).toBe('PLACED');
    expect(orderRepo.orders).toHaveLength(1);
    expect(bookRepo.store.get(B1).stock).toBe(3); // reserved once only
    expect(await mock.lookup(KEY)).toMatchObject({ status: 'SUCCESS' }); // paid once
  });

  test('repeating a successful request with the same key returns the same order (replay)', async () => {
    const { service, cartRepo, orderRepo, bookRepo } = setup();
    await fillCart(cartRepo);
    const first = await place(service);
    const second = await place(service);

    expect(second.replayed).toBe(true);
    expect(second.order.orderNumber).toBe(first.order.orderNumber);
    expect(orderRepo.orders).toHaveLength(1);
    expect(bookRepo.store.get(B1).stock).toBe(3); // not reserved twice
  });

  test('two simultaneous requests with the same key create one order', async () => {
    const { service, cartRepo, orderRepo, bookRepo } = setup();
    await fillCart(cartRepo);

    const results = await Promise.all([place(service), place(service)]);

    expect(orderRepo.orders).toHaveLength(1);
    expect(results.map((r) => r.order.orderNumber)[0]).toBe(results[1].order.orderNumber);
    expect(results.filter((r) => r.replayed)).toHaveLength(1);
    expect(bookRepo.store.get(B1).stock).toBe(3); // the loser's reservation was released
    expect(bookRepo.store.get(B2).stock).toBe(2);
  });

  test('a new key after a successful order is a new checkout (needs a cart again)', async () => {
    const { service, cartRepo } = setup();
    await fillCart(cartRepo);
    await place(service);
    await rejects(place(service, { idempotencyKey: KEY2 }), 422, 'CART_EMPTY');
  });
});
