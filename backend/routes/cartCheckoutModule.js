const express = require('express');
const { createBookRepository } = require('../repositories/bookRepository');
const { createCartRepository } = require('../repositories/cartRepository');
const { createOrderRepository } = require('../repositories/orderRepository');
const { createCartModel } = require('../models/Cart');
const { createOrderModel } = require('../models/Order');
const { createCartService } = require('../services/cartService');
const { createOrderService } = require('../services/orderService');
const { createPaymentAdapter } = require('../services/paymentAdapter');
const { createMockPaymentService } = require('../mock-payment/mockPaymentService');
const { createCartRouter } = require('./cartRoutes');
const { createOrderRouter } = require('./orderRoutes');

/**
 * The Book model belongs to the catalog. The running server already registers it on
 * its mongoose instance, so that one is reused. If it is missing (for example in a
 * script), the model from backend/models/Book.js is rebuilt on the given instance.
 */
function getBookModel(mongoose) {
  if (mongoose.models.Book) return mongoose.models.Book;
  const { schema } = require('../models/Book');
  return mongoose.model('Book', new mongoose.Schema(schema.obj, { timestamps: true }));
}

/**
 * Cart & checkout & orders module wiring (SAD C-06, C-07, C-08) with the real Mongo
 * repositories and the mock payment service.
 *
 * In the app, after the auth module is mounted (server/index.js does exactly this):
 *
 *   const { authenticate } = mountAuthApi({ app, mongooseImpl: mongoose, ... });
 *   app.use('/api/v1', createCartCheckoutRouter({ authenticate, mongooseImpl: mongoose }));
 *
 * `authenticate` verifies the bearer JWT and sets req.user.id and req.user.role.
 * `mongooseImpl` must be the same mongoose instance that the server connected, because
 * backend/ and server/ may each have their own copy in node_modules.
 * Set MOCK_PAYMENT_MODE to success (default), decline, timeout or timeout-once to
 * demonstrate each payment outcome.
 */
function createCartCheckoutRouter({ authenticate, mongooseImpl = require('mongoose') }) {
  const paymentAdapter = createPaymentAdapter({
    client: createMockPaymentService(),
    timeoutMs: 5000 // SAD 4.4: payment service must answer within 5 s
  });

  const bookRepo = createBookRepository(getBookModel(mongooseImpl));
  const cartRepo = createCartRepository(createCartModel(mongooseImpl));
  const orderRepo = createOrderRepository(createOrderModel(mongooseImpl));

  const cartService = createCartService({ cartRepo, bookRepo });
  const orderService = createOrderService({ cartRepo, bookRepo, orderRepo, paymentAdapter });

  const router = express.Router();
  router.use(createCartRouter({ cartService, authenticate }));
  router.use(createOrderRouter({ orderService, authenticate }));
  return router;
}

module.exports = { createCartCheckoutRouter };
