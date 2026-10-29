const AppError = require('../utils/AppError');
const { INPUT_LIMITS } = require('../utils/inputLimits');
const { validateText } = require('../utils/validators');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRES_IN = 60 * 60;

function invalid(field, message) {
  return new AppError(422, 'VALIDATION_ERROR', message, [{ field, message }]);
}

function createAuthService({ userRepo, jwtSecret, bcryptImpl = require('bcryptjs'), jwtImpl = require('jsonwebtoken') }) {
  async function register(input) {
    const body = input || {};
    const name = validateText(body.name, 'name', INPUT_LIMITS.name);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;

    if (!EMAIL.test(email) || email.length > INPUT_LIMITS.email) {
      throw invalid('email', 'email must be a valid email address');
    }
    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > INPUT_LIMITS.password
    ) {
      throw invalid('password', `password must be 8 to ${INPUT_LIMITS.password} characters`);
    }

    const password_hash = await bcryptImpl.hash(password, BCRYPT_ROUNDS);
    try {
      return await userRepo.create({ name, email, password_hash });
    } catch (err) {
      if (err && err.duplicate === 'email') {
        throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
      }
      throw err;
    }
  }

  async function login(input) {
    const body = input || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;
    const user = EMAIL.test(email) && email.length <= INPUT_LIMITS.email
      ? await userRepo.findByEmail(email)
      : null;
    const matches = user && typeof password === 'string' && password.length <= INPUT_LIMITS.password
      ? await bcryptImpl.compare(password, user.password_hash)
      : false;

    if (!matches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const token = jwtImpl.sign(
      { role: user.role },
      jwtSecret,
      { subject: user.id, expiresIn: TOKEN_EXPIRES_IN }
    );
    return { token, role: user.role, expiresIn: TOKEN_EXPIRES_IN };
  }

  return { register, login };
}

module.exports = { createAuthService };
