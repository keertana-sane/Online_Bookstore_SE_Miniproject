/**
 * Mock / simulated payment service (SAD C-12, SRS FR-016).
 *
 * - Returns SUCCESS, DECLINED, or a delayed answer (so the caller times out).
 * - Idempotent per payment reference: asking again about the same reference
 *   returns the recorded result and never "charges" twice (NFR-004).
 * - It only ever receives { paymentRef, amount }: no card data is accepted,
 *   logged or stored (SEC-005).
 *
 * Behaviour is chosen with MOCK_PAYMENT_MODE (or the `mode` option):
 *   success       always approves (default)
 *   decline       always declines
 *   timeout       never answers in time and records nothing
 *   timeout-once  processes the payment but answers too late the first time;
 *                 a retry with the same reference gets the recorded SUCCESS
 */
const MODES = ['success', 'decline', 'timeout', 'timeout-once'];

function createMockPaymentService({
  mode = process.env.MOCK_PAYMENT_MODE || 'success',
  delayMs = 6000 // longer than the adapter's 5 s limit (SAD 4.4)
} = {}) {
  if (!MODES.includes(mode)) {
    throw new Error(`Unknown MOCK_PAYMENT_MODE "${mode}". Use one of: ${MODES.join(', ')}`);
  }

  const processed = new Map(); // paymentRef -> { status, paymentRef, amount }

  function wait(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (timer.unref) timer.unref();
    });
  }

  async function charge({ paymentRef, amount } = {}) {
    if (!paymentRef || typeof amount !== 'number' || !(amount > 0)) {
      return { status: 'DECLINED', paymentRef, amount };
    }
    if (processed.has(paymentRef)) {
      return { ...processed.get(paymentRef) };
    }

    if (mode === 'timeout') {
      await wait(delayMs);
      return { status: 'SUCCESS', paymentRef, amount };
    }

    const result = { status: mode === 'decline' ? 'DECLINED' : 'SUCCESS', paymentRef, amount };
    processed.set(paymentRef, result);

    if (mode === 'timeout-once') {
      await wait(delayMs); // processed, but the answer arrives too late for the caller
    }
    return { ...result };
  }

  async function lookup(paymentRef) {
    const found = processed.get(paymentRef);
    return found ? { ...found } : null;
  }

  return { charge, lookup, mode };
}

module.exports = { createMockPaymentService, MODES };
