const express = require('express');

/**
 * Administrator order endpoints (FR-015), mounted under /api/v1/admin.
 */
function createAdminOrderRouter({ orderService, authenticate }) {
  const router = express.Router();
  router.use('/orders', authenticate);

  router.get('/orders', async (req, res, next) => {
    try {
      res.status(200).json(await orderService.listAdminOrders(req.query.status));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/orders/:orderId/status', async (req, res, next) => {
    try {
      res.status(200).json(await orderService.updateAdminOrderStatus(
        req.user.id,
        req.params.orderId,
        req.body && req.body.status
      ));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAdminOrderRouter };