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
  userRepo
}) {
  const repository =
    userRepo || createUserRepository(createUserModel(mongooseImpl));
  const { router, authenticate } = createAuthModule({
    jwtSecret,
    userRepo: repository,
    expressImpl,
    bcryptImpl,
    jwtImpl
  });

  app.use("/api/v1", router);
  app.use(
    "/api/v1/admin",
    authenticate,
    createRequireRoleMiddleware("ADMIN_STAFF")
  );

  return { authenticate };
}

module.exports = { mountAuthApi };
