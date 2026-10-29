/**
 * SAD 4.1 data model:
 * carts(_id, customerId, items[{bookId, quantity >= 1}], updatedAt), unique(customerId)
 *
 * Built on the mongoose instance of the running app (see createOrderModel).
 */
function createCartModel(mongoose) {
  if (mongoose.models.Cart) return mongoose.models.Cart;

  const cartItemSchema = new mongoose.Schema(
    {
      bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        validate: { validator: Number.isInteger, message: 'quantity must be a whole number' }
      }
    },
    { _id: false }
  );

  const cartSchema = new mongoose.Schema(
    {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
      },
      items: { type: [cartItemSchema], default: [] }
    },
    { timestamps: true }
  );

  return mongoose.model('Cart', cartSchema);
}

module.exports = { createCartModel };
