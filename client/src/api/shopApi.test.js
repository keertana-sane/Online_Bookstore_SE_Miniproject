import { describe, expect, it } from 'vitest';
import { ApiError, createShopApi, newIdempotencyKey } from './shopApi';

const BASE = '/api/v1';

function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { impl, calls };
}

const apiWith = (impl, token = 't') =>
  createShopApi({ baseUrl: BASE, fetchImpl: impl, getToken: () => token });

describe('shopApi: cart', () => {
  it('sends the bearer token and returns the cart', async () => {
    const { impl, calls } = fakeFetch(200, { items: [], itemCount: 0, total: 0 });
    const api = apiWith(impl, 'abc.def');

    expect(await api.getCart()).toEqual({ items: [], itemCount: 0, total: 0 });
    expect(calls[0].url).toBe('/api/v1/cart');
    expect(calls[0].options.method).toBe('GET');
    expect(calls[0].options.headers.Authorization).toBe('Bearer abc.def');
  });

  it('sends no Authorization header when there is no token', async () => {
    const { impl, calls } = fakeFetch(200, {});
    await apiWith(impl, null).getCart();
    expect(calls[0].options.headers.Authorization).toBeUndefined();
  });

  it('uses the documented methods, paths and bodies', async () => {
    const { impl, calls } = fakeFetch(200, {});
    const api = apiWith(impl);

    await api.addItem('b1');
    await api.updateQuantity('b1', 3);
    await api.removeItem('b1');

    expect(calls.map((c) => [c.options.method, c.url])).toEqual([
      ['POST', '/api/v1/cart/items'],
      ['PATCH', '/api/v1/cart/items/b1'],
      ['DELETE', '/api/v1/cart/items/b1']
    ]);
    expect(JSON.parse(calls[0].options.body)).toEqual({ bookId: 'b1', quantity: 1 });
    expect(JSON.parse(calls[1].options.body)).toEqual({ quantity: 3 });
    expect(calls[2].options.body).toBeUndefined();
  });
});

describe('shopApi: orders', () => {
  const KEY = '11111111-1111-4111-8111-111111111111';

  it('checkout sends the address in the body and the Idempotency-Key as a header', async () => {
    const { impl, calls } = fakeFetch(201, { orderNumber: 'ORD-1' });
    await apiWith(impl).placeOrder('12 MG Road', KEY);

    expect(calls[0].url).toBe('/api/v1/orders');
    expect(calls[0].options.method).toBe('POST');
    expect(calls[0].options.headers['Idempotency-Key']).toBe(KEY);
    expect(calls[0].options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].options.body)).toEqual({ shippingAddress: '12 MG Road' });
  });

  it('history, detail and cancel use the documented methods and paths', async () => {
    const { impl, calls } = fakeFetch(200, {});
    const api = apiWith(impl);

    await api.listOrders();
    await api.getOrder('o 1');
    await api.cancelOrder('o1');

    expect(calls.map((c) => [c.options.method, c.url])).toEqual([
      ['GET', '/api/v1/orders'],
      ['GET', '/api/v1/orders/o%201'],
      ['PATCH', '/api/v1/orders/o1/cancel']
    ]);
    expect(calls[2].options.body).toBeUndefined();
  });

  it('makes a valid version-4 UUID for every checkout attempt', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('shopApi: errors', () => {
  it('turns the standard error envelope into an ApiError', async () => {
    const { impl } = fakeFetch(409, {
      error: { code: 'OUT_OF_STOCK', message: 'Not enough stock', details: [{ available: 2 }] }
    });

    const err = await apiWith(impl).updateQuantity('b1', 9).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'OUT_OF_STOCK', details: [{ available: 2 }] });
  });

  it('reports an unreachable server as NETWORK_ERROR', async () => {
    const impl = async () => {
      throw new TypeError('Failed to fetch');
    };
    const err = await apiWith(impl).getCart().catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('treats a 401 without a body as UNAUTHORIZED', async () => {
    const impl = async () => ({
      ok: false,
      status: 401,
      json: async () => {
        throw new Error('no body');
      }
    });
    const err = await apiWith(impl, null).getCart().catch((e) => e);
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('keeps the order error codes the screens react to', async () => {
    const { impl } = fakeFetch(409, { error: { code: 'CANCEL_NOT_ALLOWED', message: 'no' } });
    const err = await apiWith(impl).cancelOrder('o1').catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'CANCEL_NOT_ALLOWED' });
  });
});
