const mongoose = require('mongoose');
const { createOrderModel, ORDER_STATUSES } = require('../models/Order');
const { createCartModel } = require('../models/Cart');
const { createOrderRepository } = require('../repositories/orderRepository');
const { createCartCheckoutRouter } = require('../routes/cartCheckoutModule');

const CUSTOMER = 'bbbbbbbbbbbbbbbbbbbbbbb1';
const ORDER_ID = 'cccccccccccccccccccccccc';

describe('Order model (FR-011, TC-TRK-04)', () => {
  const Order = createOrderModel(mongoose);
  const check = (doc) => doc.validate().then(() => undefined, (error) => error);
  const valid = () => ({
    orderNumber: 'ORD-20261026-ABCD1234',
    customerId: CUSTOMER,
    items: [{ bookId: 'aaaaaaaaaaaaaaaaaaaaaaa1', title: 'Book', quantity: 1, unitPrice: 10 }],
    total: 10,
    shippingAddress: '12 MG Road',
    paymentStatus: 'SUCCESS',
    paymentRef: 'ref',
    idempotencyKey: 'key'
  });

  test('allows exactly the five statuses from the SRS', async () => {
    expect(ORDER_STATUSES).toEqual(['PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    for (const status of ORDER_STATUSES) {
      expect(await check(new Order({ ...valid(), orderStatus: status }))).toBeUndefined();
    }
  });

  test('rejects any other status such as SHIPPING', async () => {
    const error = await check(new Order({ ...valid(), orderStatus: 'SHIPPING' }));
    expect(error.errors.orderStatus).toBeDefined();
  });

  test('an order needs at least one item (SRS 6.5)', async () => {
    const error = await check(new Order({ ...valid(), items: [] }));
    expect(error.errors.items).toBeDefined();
  });

  test('a shipping address of 301 characters is rejected, 300 accepted', async () => {
    expect(await check(new Order({ ...valid(), shippingAddress: 'x'.repeat(300) }))).toBeUndefined();
    const error = await check(new Order({ ...valid(), shippingAddress: 'x'.repeat(301) }));
    expect(error.errors.shippingAddress).toBeDefined();
  });

  test('has the unique indexes that make checkout retry-safe (NFR-004, FR-010)', () => {
    const indexes = Order.schema.indexes();
    expect(indexes).toContainEqual([
      { customerId: 1, idempotencyKey: 1 },
      expect.objectContaining({ unique: true })
    ]);
    expect(Order.schema.path('orderNumber').options.unique).toBe(true);
  });

  test('building the models twice reuses the same model', () => {
    expect(createOrderModel(mongoose)).toBe(Order);
    expect(createCartModel(mongoose)).toBe(createCartModel(mongoose));
  });
});

/** A stand-in for the mongoose model that records the queries the repository sends. */
function fakeModel() {
  const calls = {};
  const chain = (name, result) => (...args) => {
    calls[name] = args;
    const q = {
      sort: (s) => {
        calls.sort = s;
        return q;
      },
      lean: async () => result
    };
    return q;
  };
  return { calls, find: chain('find', []), findOne: chain('findOne', null), findOneAndUpdate: chain('findOneAndUpdate', null) };
}

describe('order repository queries (ownership and atomic cancel)', () => {
  test('history only asks for the customer\'s confirmed orders, newest first', async () => {
    const Order = fakeModel();
    await createOrderRepository(Order).listByCustomer(CUSTOMER);
    expect(Order.calls.find[0]).toEqual({ customerId: CUSTOMER, paymentStatus: 'SUCCESS' });
    expect(Order.calls.sort).toEqual({ createdAt: -1, _id: -1 });
  });

  test('detail filters by owner, so another customer\'s order is not found', async () => {
    const Order = fakeModel();
    expect(await createOrderRepository(Order).findByIdForCustomer(CUSTOMER, ORDER_ID)).toBeNull();
    expect(Order.calls.findOne[0]).toEqual({
      _id: ORDER_ID,
      customerId: CUSTOMER,
      paymentStatus: 'SUCCESS'
    });
  });

  test('a malformed order id never reaches the database', async () => {
    const Order = fakeModel();
    const repo = createOrderRepository(Order);
    expect(await repo.findByIdForCustomer(CUSTOMER, 'not-an-id')).toBeNull();
    expect(await repo.transitionStatus(CUSTOMER, 'not-an-id', 'PLACED', 'CANCELLED', {})).toBeNull();
    expect(Order.calls.findOne).toBeUndefined();
    expect(Order.calls.findOneAndUpdate).toBeUndefined();
  });

  test('cancel is one conditional update on owner AND current status', async () => {
    const Order = fakeModel();
    const entry = { status: 'CANCELLED', actor: CUSTOMER, at: new Date() };
    await createOrderRepository(Order).transitionStatus(CUSTOMER, ORDER_ID, 'PLACED', 'CANCELLED', entry);

    const [filter, update, options] = Order.calls.findOneAndUpdate;
    expect(filter).toEqual({
      _id: ORDER_ID,
      customerId: CUSTOMER,
      paymentStatus: 'SUCCESS',
      orderStatus: 'PLACED'
    });
    expect(update).toEqual({ $set: { orderStatus: 'CANCELLED' }, $push: { statusHistory: entry } });
    expect(options).toEqual({ new: true });
  });
});

describe('module wiring on the app\'s mongoose instance', () => {
  test('builds the cart and orders router without a database connection', () => {
    const m = new mongoose.Mongoose();
    m.model('Book', new m.Schema({ title: String }));
    const router = createCartCheckoutRouter({ authenticate: (req, res, next) => next(), mongooseImpl: m });

    expect(typeof router).toBe('function');
    expect(Object.keys(m.models).sort()).toEqual(['Book', 'Cart', 'Order']);
  });

  test('rebuilds the Book model if the app has not registered one', () => {
    const m = new mongoose.Mongoose();
    createCartCheckoutRouter({ authenticate: (req, res, next) => next(), mongooseImpl: m });
    expect(m.models.Book.schema.path('stock_quantity')).toBeDefined();
  });
});
