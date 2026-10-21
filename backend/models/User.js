
function createUserModel(mongoose = require('mongoose')) {
  if (mongoose.models.User) {
    return mongoose.models.User;
  }

  const userSchema = new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true
      },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
      },
      password_hash: {
        type: String,
        required: true
      },
      role: {
        type: String,
        enum: ['CUSTOMER', 'ADMIN_STAFF'],
        required: true,
        default: 'CUSTOMER'
      },
      shipping_address: {
        type: String,
        default: ''
      }
    },
    { timestamps: true }
  );

  return mongoose.model('User', userSchema);
}

module.exports = { createUserModel };
