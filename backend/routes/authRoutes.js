function createAuthRouter({ authService, expressImpl = require('express') }) {
  const router = expressImpl.Router();

  router.post('/auth/register', async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
