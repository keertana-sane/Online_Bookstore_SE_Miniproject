const express = require('express');
const { customerIdOf } = require('./cartRoutes');

/**
 * Checkout endpoint (SAD API-09), CUSTOMER only:
 *   POST /orders   body { shippingAddress }   header Idempotency-Key: <UUID>
 *     201 created, 200 replay of an earlier identical request,
 *     401, 402 PAYMENT_DECLINED, 409 OUT_OF_STOCK, 422 VALIDATION_ERROR / CART_EMPTY,
 *     504 PAYMENT_TIMEOUT (retry with the same key)
 *
 * Order history, detail and cancel (API-10 to API-12) are added in Sprint 2.
 * Mount under the /api/v1 base path, like the cart router.
 */
function createOrderRouter({ orderService, authenticate }) {
  const router = express.Router();
  router.use('/orders', authenticate);

  router.post('/orders', async (req, res, next) => {
    try {
      const { order, replayed } = await orderService.placeOrder(customerIdOf(req), {
        shippingAddress: (req.body || {}).shippingAddress,
        idempotencyKey: req.get('Idempotency-Key')
      });
      res.status(replayed ? 200 : 201).json(order);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createOrderRouter };
