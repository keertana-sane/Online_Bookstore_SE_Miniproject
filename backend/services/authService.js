const AppError = require('../utils/AppError');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRES_IN = 60 * 60;

function invalid(field, message) {
  return new AppError(422, 'VALIDATION_ERROR', message, [{ field, message }]);
}

function createAuthService({ userRepo, jwtSecret, bcryptImpl = require('bcryptjs'), jwtImpl = require('jsonwebtoken') }) {
  async function register(input) {
    const body = input || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;

    if (!name) {
      throw invalid('name', 'name is required');
    }
    if (!EMAIL.test(email)) {
      throw invalid('email', 'email must be a valid email address');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw invalid('password', 'password must be at least 8 characters');
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
    const user = EMAIL.test(email) ? await userRepo.findByEmail(email) : null;
    const matches = user && typeof password === 'string'
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
