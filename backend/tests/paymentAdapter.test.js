const { createPaymentAdapter } = require('../services/paymentAdapter');
const { createMockPaymentService } = require('../mock-payment/mockPaymentService');

const REF = '11111111-1111-4111-8111-111111111111';

describe('payment adapter with the mock payment service (FR-016, NFR-006)', () => {
  test('SUCCESS is passed through', async () => {
    const adapter = createPaymentAdapter({ client: createMockPaymentService({ mode: 'success' }) });
    expect(await adapter.authorize({ paymentRef: REF, amount: 100 })).toEqual({
      status: 'SUCCESS',
      paymentRef: REF
    });
  });

  test('DECLINED is passed through', async () => {
    const adapter = createPaymentAdapter({ client: createMockPaymentService({ mode: 'decline' }) });
    expect((await adapter.authorize({ paymentRef: REF, amount: 100 })).status).toBe('DECLINED');
  });

  test('no answer within the limit is reported as TIMEOUT', async () => {
    const client = createMockPaymentService({ mode: 'timeout', delayMs: 300 });
    const adapter = createPaymentAdapter({ client, timeoutMs: 30 });
    expect((await adapter.authorize({ paymentRef: REF, amount: 100 })).status).toBe('TIMEOUT');
  });

  test('an error from the service is reported as TIMEOUT (safe to retry)', async () => {
    const client = { charge: async () => { throw new Error('connection reset'); } };
    const adapter = createPaymentAdapter({ client });
    expect((await adapter.authorize({ paymentRef: REF, amount: 100 })).status).toBe('TIMEOUT');
  });

  test('an unexpected answer is never treated as success', async () => {
    for (const bad of [undefined, null, {}, { status: 'OK' }, { status: 'success' }]) {
      const adapter = createPaymentAdapter({ client: { charge: async () => bad } });
      expect((await adapter.authorize({ paymentRef: REF, amount: 100 })).status).toBe('DECLINED');
    }
  });

  test('the adapter forwards only the reference and amount to the payment client', async () => {
    const charge = jest.fn().mockResolvedValue({ status: 'SUCCESS' });
    const adapter = createPaymentAdapter({ client: { charge } });
    await adapter.authorize({
      paymentRef: REF,
      amount: 100,
      cardNumber: '4111111111111111',
      cvv: '123'
    });

    expect(charge).toHaveBeenCalledWith({ paymentRef: REF, amount: 100 });
  });

  test('a late failure after the timeout does not crash the process', async () => {
    const client = {
      charge: () => new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 60))
    };
    const adapter = createPaymentAdapter({ client, timeoutMs: 10 });
    expect((await adapter.authorize({ paymentRef: REF, amount: 5 })).status).toBe('TIMEOUT');
    await new Promise((r) => setTimeout(r, 100)); // would raise an unhandled rejection if not handled
  });

  test('timeout-once: retry with the same reference returns the recorded SUCCESS, no second charge', async () => {
    const client = createMockPaymentService({ mode: 'timeout-once', delayMs: 300 });
    const charge = jest.spyOn(client, 'charge');
    const adapter = createPaymentAdapter({ client, timeoutMs: 30 });

    expect((await adapter.authorize({ paymentRef: REF, amount: 100 })).status).toBe('TIMEOUT');
    expect(await adapter.lookup(REF)).toEqual({ status: 'SUCCESS', paymentRef: REF });
    expect((await adapter.authorize({ paymentRef: REF, amount: 100 })).status).toBe('SUCCESS');
    expect(charge).toHaveBeenCalledTimes(2);
  });

  test('lookup returns null for an unknown reference', async () => {
    const adapter = createPaymentAdapter({ client: createMockPaymentService() });
    expect(await adapter.lookup('unknown')).toBeNull();
  });
});

describe('mock payment service', () => {
  test('is idempotent per payment reference', async () => {
    const svc = createMockPaymentService({ mode: 'success' });
    const first = await svc.charge({ paymentRef: REF, amount: 50 });
    const second = await svc.charge({ paymentRef: REF, amount: 50 });
    expect(second).toEqual(first);
  });

  test('declines an invalid amount or missing reference', async () => {
    const svc = createMockPaymentService();
    expect((await svc.charge({ paymentRef: REF, amount: 0 })).status).toBe('DECLINED');
    expect((await svc.charge({ amount: 10 })).status).toBe('DECLINED');
  });

  test('never accepts or returns card data (SEC-005)', async () => {
    const svc = createMockPaymentService();
    const result = await svc.charge({
      paymentRef: REF,
      amount: 10,
      cardNumber: '4111111111111111',
      cvv: '123'
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain('4111111111111111');
    expect(text).not.toMatch(/cvv|cardNumber/i);
    expect(Object.keys(result).sort()).toEqual(['amount', 'paymentRef', 'status']);
  });

  test('rejects an unknown mode so typos are caught', () => {
    expect(() => createMockPaymentService({ mode: 'sucess' })).toThrow(/Unknown MOCK_PAYMENT_MODE/);
  });
});
