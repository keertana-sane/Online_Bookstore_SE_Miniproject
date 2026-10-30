
const mongoose = require('mongoose');
const { isValidPrice } = require('../utils/inputLimits');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 99999999.99,
      validate: { validator: isValidPrice, message: 'price must have at most two decimal places' }
    },
    stock_quantity: {
      type: Number,
      required: true,
      min: 0,
      max: 999999,
      validate: { validator: Number.isInteger, message: 'stock_quantity must be a whole number' },
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    cover_image: {
      type: String,
      default: ''
    },
    is_active: {
      type: Boolean,
      default: true
    },
    seedBatch: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);
// BK-29: Optimize active catalog browsing and newest-first pagination.
bookSchema.index({ is_active: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('Book', bookSchema);
