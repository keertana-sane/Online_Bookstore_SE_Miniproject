const { createCartService } = require('../services/cartService');
const { createFakeBookRepo, createFakeCartRepo } = require('./helpers/fakeRepos');

const CUSTOMER = 'cust-1';
const B1 = 'aaaaaaaaaaaaaaaaaaaaaaa1'; // 499.00, stock 5
const B2 = 'aaaaaaaaaaaaaaaaaaaaaaa2'; // 250.50, stock 3
const B_OUT = 'aaaaaaaaaaaaaaaaaaaaaaa3'; // out of stock
const B_OFF = 'aaaaaaaaaaaaaaaaaaaaaaa4'; // disabled

function setup() {
  const bookRepo = createFakeBookRepo([
    { id: B1, title: 'Book One', price: 499.0, stock: 5 },
    { id: B2, title: 'Book Two', price: 250.5, stock: 3 },
    { id: B_OUT, title: 'Sold Out', price: 100, stock: 0 },
    { id: B_OFF, title: 'Disabled', price: 100, stock: 4, isActive: false }
  ]);
  const cartRepo = createFakeCartRepo();
  return { bookRepo, cartRepo, service: createCartService({ cartRepo, bookRepo }) };
}

const rejects = async (promise, status, code) => {
  await expect(promise).rejects.toMatchObject({ status, code });
};

describe('cartService - add to cart (FR-006, TC-CART)', () => {
  test('adds an in-stock book with default quantity 1', async () => {
    const { service } = setup();
    const cart = await service.addItem(CUSTOMER, B1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ bookId: B1, quantity: 1, unitPrice: 499, subtotal: 499 });
  });

  test('adding the same book again increases the quantity', async () => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 1);
    const cart = await service.addItem(CUSTOMER, B1, 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  test('out-of-stock book is rejected with 409 OUT_OF_STOCK', async () => {
    const { service } = setup();
    await rejects(service.addItem(CUSTOMER, B_OUT, 1), 409, 'OUT_OF_STOCK');
  });

  test('cannot add more than the available stock (boundary: stock 5)', async () => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 5); // exactly the stock is allowed
    await rejects(service.addItem(CUSTOMER, B1, 1), 409, 'OUT_OF_STOCK');
  });

  test('unknown or disabled book gives 404 BOOK_NOT_FOUND', async () => {
    const { service } = setup();
    await rejects(service.addItem(CUSTOMER, 'bbbbbbbbbbbbbbbbbbbbbbbb', 1), 404, 'BOOK_NOT_FOUND');
    await rejects(service.addItem(CUSTOMER, B_OFF, 1), 404, 'BOOK_NOT_FOUND');
  });

  test.each([0, -1, 1.5, '2', null])('invalid quantity %p gives 422 VALIDATION_ERROR', async (q) => {
    const { service } = setup();
    await rejects(service.addItem(CUSTOMER, B1, q), 422, 'VALIDATION_ERROR');
  });

  test('carts are separate per customer', async () => {
    const { service } = setup();
    await service.addItem('cust-1', B1, 1);
    const other = await service.getCart('cust-2');
    expect(other.items).toHaveLength(0);
  });
});

describe('cartService - update and remove (FR-007)', () => {
  test('updates the quantity of a line', async () => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 1);
    const cart = await service.updateItem(CUSTOMER, B1, 4);
    expect(cart.items[0].quantity).toBe(4);
    expect(cart.total).toBe(1996);
  });

  test.each([0, -1])('quantity %p gives 422 and leaves the cart unchanged', async (q) => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 2);
    await rejects(service.updateItem(CUSTOMER, B1, q), 422, 'VALIDATION_ERROR');
    expect((await service.getCart(CUSTOMER)).items[0].quantity).toBe(2);
  });

  test('quantity above stock gives 409 OUT_OF_STOCK', async () => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 1);
    await rejects(service.updateItem(CUSTOMER, B1, 6), 409, 'OUT_OF_STOCK');
  });

  test('updating or removing a book that is not in the cart gives 404', async () => {
    const { service } = setup();
    await rejects(service.updateItem(CUSTOMER, B1, 1), 404, 'BOOK_NOT_FOUND');
    await rejects(service.removeItem(CUSTOMER, B1), 404, 'BOOK_NOT_FOUND');
  });

  test('removes a line and recomputes the total', async () => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 1);
    await service.addItem(CUSTOMER, B2, 1);
    const cart = await service.removeItem(CUSTOMER, B1);
    expect(cart.items.map((i) => i.bookId)).toEqual([B2]);
    expect(cart.total).toBe(250.5);
  });
});

describe('cartService - cart total (FR-008, TC-CART unit test)', () => {
  test('2 x 499.00 + 1 x 250.50 = 1248.50', async () => {
    const { service } = setup();
    await service.addItem(CUSTOMER, B1, 2);
    const cart = await service.addItem(CUSTOMER, B2, 1);
    expect(cart.total).toBe(1248.5);
    expect(cart.items.map((i) => i.subtotal)).toEqual([998, 250.5]);
  });

  test('empty cart total is 0.00', async () => {
    const { service } = setup();
    const cart = await service.getCart(CUSTOMER);
    expect(cart).toMatchObject({ items: [], itemCount: 0, total: 0 });
  });

  test('uses current database price, not a stale one', async () => {
    const { service, bookRepo } = setup();
    await service.addItem(CUSTOMER, B1, 1);
    bookRepo.store.get(B1).price = 450;
    expect((await service.getCart(CUSTOMER)).total).toBe(450);
  });

  test('avoids floating point drift (0.1 + 0.2 style prices)', async () => {
    const { service, bookRepo } = setup();
    bookRepo.store.set('aaaaaaaaaaaaaaaaaaaaaaa5', {
      id: 'aaaaaaaaaaaaaaaaaaaaaaa5', title: 'A', price: 0.1, stock: 10, isActive: true
    });
    bookRepo.store.set('aaaaaaaaaaaaaaaaaaaaaaa6', {
      id: 'aaaaaaaaaaaaaaaaaaaaaaa6', title: 'B', price: 0.2, stock: 10, isActive: true
    });
    await service.addItem(CUSTOMER, 'aaaaaaaaaaaaaaaaaaaaaaa5', 1);
    const cart = await service.addItem(CUSTOMER, 'aaaaaaaaaaaaaaaaaaaaaaa6', 1);
    expect(cart.total).toBe(0.3);
  });

  test('a book disabled after being added is flagged and left out of the total', async () => {
    const { service, bookRepo } = setup();
    await service.addItem(CUSTOMER, B1, 1);
    await service.addItem(CUSTOMER, B2, 1);
    bookRepo.store.get(B1).isActive = false;
    const cart = await service.getCart(CUSTOMER);
    expect(cart.items.find((i) => i.bookId === B1).available).toBe(false);
    expect(cart.total).toBe(250.5);
  });
});
