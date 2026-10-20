const express = require('express');
const { requireBookId } = require('../utils/validators');

/**
 * Cart endpoints (SAD API-05 to API-08), all for a logged-in CUSTOMER:
 *   GET    /cart                  view cart with total
 *   POST   /cart/items            add in-stock book        { bookId, quantity? }
 *   PATCH  /cart/items/:bookId    change quantity          { quantity }
 *   DELETE /cart/items/:bookId    remove item
 *
 * `authenticate` is the JWT middleware owned by the Auth module (BK-07). It must
 * set req.user so that the customer id is available as req.user.id (or _id / sub).
 * Mount the router under the /api/v1 base path: app.use('/api/v1', router).
 */
function customerIdOf(req) {
  const user = req.user || {};
  return String(user.id || user._id || user.sub);
}

function createCartRouter({ cartService, authenticate }) {
  const router = express.Router();
  router.use('/cart', authenticate);

  const wrap = (fn) => async (req, res, next) => {
    try {
      res.status(200).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };

  router.get('/cart', wrap((req) => cartService.getCart(customerIdOf(req))));

  router.post(
    '/cart/items',
    wrap((req) => {
      const body = req.body || {};
      return cartService.addItem(customerIdOf(req), requireBookId(body.bookId), body.quantity);
    })
  );

  router.patch(
    '/cart/items/:bookId',
    wrap((req) =>
      cartService.updateItem(
        customerIdOf(req),
        requireBookId(req.params.bookId),
        (req.body || {}).quantity
      )
    )
  );

  router.delete(
    '/cart/items/:bookId',
    wrap((req) => cartService.removeItem(customerIdOf(req), requireBookId(req.params.bookId)))
  );

  return router;
}

module.exports = { createCartRouter, customerIdOf };
