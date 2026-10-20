
const mongoose = require('mongoose');

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
      min: 0
    },
    stock_quantity: {
      type: Number,
      required: true,
      min: 0,
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

module.exports = mongoose.model('Book', bookSchema);
