// SAD 4.1 data model: orders collection.
const ORDER_STATUSES = ['PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUSES = ['SUCCESS', 'FAILED'];

/**
 * Builds the Order model on the mongoose instance of the running app. The app passes
 * its own instance in (same pattern as createUserModel) so the model uses the one
 * database connection that the server opened.
 */
function createOrderModel(mongoose) {
  if (mongoose.models.Order) return mongoose.models.Order;

  const orderItemSchema = new mongoose.Schema(
    {
      bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
      title: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true, min: 0 } // price at the time of purchase
    },
    { _id: false }
  );

  const statusHistorySchema = new mongoose.Schema(
    {
      status: { type: String, enum: ORDER_STATUSES, required: true },
      actor: { type: String, required: true }, // customer id, staff id or "system"
      at: { type: Date, required: true }
    },
    { _id: false }
  );

  const orderSchema = new mongoose.Schema(
    {
      orderNumber: { type: String, required: true, unique: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      items: { type: [orderItemSchema], validate: (v) => v.length > 0 }, // an order needs >= 1 item
      total: { type: Number, required: true, min: 0 },
      shippingAddress: { type: String, required: true, maxlength: 300 },
      orderStatus: { type: String, enum: ORDER_STATUSES, default: 'PLACED', required: true },
      paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true },
      paymentRef: { type: String, required: true },
      idempotencyKey: { type: String, required: true },
      statusHistory: { type: [statusHistorySchema], default: [] }
    },
    { timestamps: true }
  );

  // One order per customer + idempotency key: a checkout retry can never create a second order.
  orderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
  orderSchema.index({ customerId: 1, createdAt: -1 });

  return mongoose.model('Order', orderSchema);
}

module.exports = { createOrderModel, ORDER_STATUSES, PAYMENT_STATUSES };
