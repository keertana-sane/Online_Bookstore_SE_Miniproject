import { describe, expect, it } from 'vitest';
import { ApiError, createCartApi } from './cartApi';

function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { impl, calls };
}

describe('cartApi', () => {
  it('sends the bearer token and returns the cart', async () => {
    const { impl, calls } = fakeFetch(200, { items: [], itemCount: 0, total: 0 });
    const api = createCartApi({ fetchImpl: impl, getToken: () => 'abc.def' });

    expect(await api.getCart()).toEqual({ items: [], itemCount: 0, total: 0 });
    expect(calls[0].url).toBe('/api/v1/cart');
    expect(calls[0].options.method).toBe('GET');
    expect(calls[0].options.headers.Authorization).toBe('Bearer abc.def');
  });

  it('sends no Authorization header when there is no token', async () => {
    const { impl, calls } = fakeFetch(200, {});
    await createCartApi({ fetchImpl: impl, getToken: () => null }).getCart();
    expect(calls[0].options.headers.Authorization).toBeUndefined();
  });

  it('uses the documented methods, paths and bodies', async () => {
    const { impl, calls } = fakeFetch(200, {});
    const api = createCartApi({ fetchImpl: impl, getToken: () => 't' });

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

  it('turns the standard error envelope into an ApiError', async () => {
    const { impl } = fakeFetch(409, {
      error: { code: 'OUT_OF_STOCK', message: 'Not enough stock', details: [{ available: 2 }] }
    });
    const api = createCartApi({ fetchImpl: impl, getToken: () => 't' });

    const err = await api.updateQuantity('b1', 9).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'OUT_OF_STOCK', details: [{ available: 2 }] });
  });

  it('reports an unreachable server as NETWORK_ERROR', async () => {
    const impl = async () => { throw new TypeError('Failed to fetch'); };
    const err = await createCartApi({ fetchImpl: impl, getToken: () => 't' }).getCart().catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('treats a 401 without a body as UNAUTHORIZED', async () => {
    const impl = async () => ({ ok: false, status: 401, json: async () => { throw new Error('no body'); } });
    const err = await createCartApi({ fetchImpl: impl, getToken: () => null }).getCart().catch((e) => e);
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });
});
