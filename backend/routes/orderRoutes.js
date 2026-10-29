const express = require('express');
const { customerIdOf } = require('./cartRoutes');

/**
 * Order endpoints (SAD API-09 to API-12), CUSTOMER only:
 *   POST  /orders                  checkout    body { shippingAddress }   header Idempotency-Key: <UUID>
 *     201 created, 200 replay of an earlier identical request,
 *     401, 402 PAYMENT_DECLINED, 409 OUT_OF_STOCK, 422 VALIDATION_ERROR / CART_EMPTY,
 *     504 PAYMENT_TIMEOUT (retry with the same key)
 *   GET   /orders                  own order history, newest first       200 { orders: [] }
 *   GET   /orders/:orderId         own order detail and status           200, 404 ORDER_NOT_FOUND
 *   PATCH /orders/:orderId/cancel  cancel own PLACED order               200, 404, 409 CANCEL_NOT_ALLOWED
 *
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

  const wrap = (fn) => async (req, res, next) => {
    try {
      res.status(200).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };

  router.get('/orders', wrap((req) => orderService.listOrders(customerIdOf(req))));

  router.get(
    '/orders/:orderId',
    wrap((req) => orderService.getOrder(customerIdOf(req), req.params.orderId))
  );

  router.patch(
    '/orders/:orderId/cancel',
    wrap((req) => orderService.cancelOrder(customerIdOf(req), req.params.orderId))
  );

  return router;
}

module.exports = { createOrderRouter };
