const request = require('supertest');
const { createCartService } = require('../services/cartService');
const { createCartRouter } = require('../routes/cartRoutes');
const { createFakeBookRepo, createFakeCartRepo } = require('./helpers/fakeRepos');
const { createTestApp } = require('./helpers/testApp');

const B1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const B2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const AUTH = { Authorization: 'Bearer cust-1' };

function buildApp() {
  const bookRepo = createFakeBookRepo([
    { id: B1, title: 'Book One', price: 499, stock: 5 },
    { id: B2, title: 'Book Two', price: 250.5, stock: 3 }
  ]);
  const cartService = createCartService({ cartRepo: createFakeCartRepo(), bookRepo });
  return createTestApp(({ authenticate }) => createCartRouter({ cartService, authenticate }));
}

describe('cart HTTP API (API-05 to API-08)', () => {
  test('401 without a token on every cart endpoint', async () => {
    const app = buildApp();
    await request(app).get('/api/v1/cart').expect(401);
    await request(app).post('/api/v1/cart/items').send({ bookId: B1 }).expect(401);
    await request(app).patch(`/api/v1/cart/items/${B1}`).send({ quantity: 1 }).expect(401);
    await request(app).delete(`/api/v1/cart/items/${B1}`).expect(401);
  });

  test('add, update, view and remove return the full cart with total', async () => {
    const app = buildApp();

    let res = await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: B1, quantity: 2 }).expect(200);
    expect(res.body.total).toBe(998);

    res = await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: B2 }).expect(200);
    expect(res.body.total).toBe(1248.5);

    res = await request(app).patch(`/api/v1/cart/items/${B2}`).set(AUTH).send({ quantity: 2 }).expect(200);
    expect(res.body.total).toBe(1499);

    res = await request(app).get('/api/v1/cart').set(AUTH).expect(200);
    expect(res.body.items).toHaveLength(2);

    res = await request(app).delete(`/api/v1/cart/items/${B1}`).set(AUTH).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(501);
  });

  test('invalid input gives 422 with the standard error envelope', async () => {
    const app = buildApp();
    let res = await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: 'not-an-id' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    res = await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: B1, quantity: 0 }).expect(422);
    expect(res.body.error.details[0].field).toBe('quantity');

    await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: B1 }).expect(200);
    await request(app).patch(`/api/v1/cart/items/${B1}`).set(AUTH).send({ quantity: -1 }).expect(422);
  });

  test('over-stock gives 409 OUT_OF_STOCK and unknown book gives 404', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: B1, quantity: 6 }).expect(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
    await request(app).post('/api/v1/cart/items').set(AUTH).send({ bookId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }).expect(404);
    await request(app).delete(`/api/v1/cart/items/${B2}`).set(AUTH).expect(404);
  });
});
