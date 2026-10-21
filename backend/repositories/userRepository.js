function toDomain(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    shipping_address: doc.shipping_address
  };
}

function createUserRepository(User = require('../models/User').createUserModel()) {
  async function create(data) {
    try {
      const doc = await User.create(data);
      return toDomain(doc);
    } catch (err) {
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.email) {
        throw Object.assign(new Error('duplicate email'), { duplicate: 'email' });
      }
      throw err;
    }
  }

  async function findByEmail(email) {
    const doc = await User.findOne({ email }).lean();
    if (!doc) return null;
    return {
      id: String(doc._id),
      name: doc.name,
      email: doc.email,
      role: doc.role,
      password_hash: doc.password_hash
    };
  }

  return { create, findByEmail };
}

let defaultRepo;

function getDefaultRepo() {
  defaultRepo ||= createUserRepository();
  return defaultRepo;
}

module.exports = {
  createUserRepository,
  create: (...args) => getDefaultRepo().create(...args),
  findByEmail: (...args) => getDefaultRepo().findByEmail(...args)
};
