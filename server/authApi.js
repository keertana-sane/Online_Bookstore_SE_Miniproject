const { createAuthModule } = require("../backend/routes/authModule");
const { createUserModel } = require("../backend/models/User");
const { createUserRepository } = require("../backend/repositories/userRepository");
const { createRequireRoleMiddleware } = require("../backend/middleware/requireRole");

function mountAuthApi({
  app,
  expressImpl,
  mongooseImpl,
  jwtSecret,
  bcryptImpl,
  jwtImpl,
  securityLogger,
  userRepo
}) {
  const repository =
    userRepo || createUserRepository(createUserModel(mongooseImpl));
  const { router, authenticate } = createAuthModule({
    jwtSecret,
    userRepo: repository,
    expressImpl,
    bcryptImpl,
    jwtImpl,
    securityLogger
  });

  app.use("/api/v1", router);
  app.use(
    "/api/v1/admin",
    authenticate,
    createRequireRoleMiddleware("ADMIN_STAFF", { securityLogger })
  );

  return { authenticate };
}

module.exports = { mountAuthApi };
