/**
 * Payment adapter (SAD C-08): the only place the order module talks to a payment
 * service. It hides the concrete service behind two calls and maps every outcome
 * to exactly one of SUCCESS, DECLINED or TIMEOUT:
 *
 *   authorize({ paymentRef, amount }) -> { status, paymentRef }
 *   lookup(paymentRef)               -> { status, paymentRef } | null
 *
 * Rules:
 *  - An order is only ever confirmed on an explicit SUCCESS. Anything unexpected is
 *    treated as DECLINED, never as success (FR-016: no confirmed order on failure).
 *  - No answer within timeoutMs (5 s, SAD 4.4) or an error talking to the service is
 *    reported as TIMEOUT, which is safe to retry because the reference is idempotent.
 *  - Tests inject a stub `client`, so no real payment service is needed (NFR-006).
 */
const OUTCOMES = ['SUCCESS', 'DECLINED', 'TIMEOUT'];

function normalize(result, paymentRef) {
  const status = result && OUTCOMES.includes(result.status) ? result.status : 'DECLINED';
  return { status, paymentRef };
}

function createPaymentAdapter({ client, timeoutMs = 5000 }) {
  function withTimeout(promise) {
    let timer;
    const original = Promise.resolve(promise);
    original.catch(() => {}); // a late failure after the timeout must not crash the process
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ status: 'TIMEOUT' }), timeoutMs);
    });
    return Promise.race([original, timeout]).finally(() => clearTimeout(timer));
  }

  async function authorize({ paymentRef, amount }) {
    try {
      // Only the reference and the amount are ever sent: no card data (SEC-005).
      return normalize(await withTimeout(client.charge({ paymentRef, amount })), paymentRef);
    } catch (err) {
      return { status: 'TIMEOUT', paymentRef };
    }
  }

  async function lookup(paymentRef) {
    try {
      const found = await withTimeout(client.lookup(paymentRef));
      if (!found || found.status === 'TIMEOUT') return null;
      return normalize(found, paymentRef);
    } catch (err) {
      return null;
    }
  }

  return { authorize, lookup };
}

module.exports = { createPaymentAdapter };
