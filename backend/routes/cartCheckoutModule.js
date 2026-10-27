const express = require('express');
const bookRepo = require('../repositories/bookRepository');
const cartRepo = require('../repositories/cartRepository');
const orderRepo = require('../repositories/orderRepository');
const { createCartService } = require('../services/cartService');
const { createOrderService } = require('../services/orderService');
const { createPaymentAdapter } = require('../services/paymentAdapter');
const { createMockPaymentService } = require('../mock-payment/mockPaymentService');
const { createCartRouter } = require('./cartRoutes');
const { createOrderRouter } = require('./orderRoutes');

/**
 * Cart & checkout module wiring (SAD C-06, C-07, C-08) with the real Mongo
 * repositories and the mock payment service.
 *
 * In the app:
 *
 *   const { createAuthModule } = require('./routes/authModule');
 *   const { createCartCheckoutRouter } = require('./routes/cartCheckoutModule');
 *   const { router: authRouter, authenticate } = createAuthModule();
 *   app.use('/api/v1', authRouter);
 *   app.use('/api/v1', createCartCheckoutRouter({ authenticate }));
 *
 * `authenticate` verifies the bearer JWT and sets req.user.id and req.user.role.
 * Set MOCK_PAYMENT_MODE to success (default), decline, timeout or timeout-once to
 * demonstrate each payment outcome.
 */
function createCartCheckoutRouter({ authenticate }) {
  const paymentAdapter = createPaymentAdapter({
    client: createMockPaymentService(),
    timeoutMs: 5000 // SAD 4.4: payment service must answer within 5 s
  });

  const cartService = createCartService({ cartRepo, bookRepo });
  const orderService = createOrderService({ cartRepo, bookRepo, orderRepo, paymentAdapter });

  const router = express.Router();
  router.use(createCartRouter({ cartService, authenticate }));
  router.use(createOrderRouter({ orderService, authenticate }));
  return router;
}

module.exports = { createCartCheckoutRouter };
