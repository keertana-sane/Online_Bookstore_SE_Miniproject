const ORDER_TRANSITIONS = Object.freeze({
  PLACED: Object.freeze(['PROCESSING', 'CANCELLED']),
  PROCESSING: Object.freeze(['SHIPPED', 'CANCELLED']),
  SHIPPED: Object.freeze(['DELIVERED']),
  DELIVERED: Object.freeze([]),
  CANCELLED: Object.freeze([])
});

function canTransitionOrderStatus(fromStatus, toStatus) {
  return (ORDER_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function assertOrderStatusTransition(fromStatus, toStatus) {
  if (!canTransitionOrderStatus(fromStatus, toStatus)) {
    const error = new Error(`Invalid order status transition: ${fromStatus} -> ${toStatus}`);
    error.code = 'INVALID_ORDER_STATUS_TRANSITION';
    throw error;
  }
}

module.exports = { ORDER_TRANSITIONS, canTransitionOrderStatus, assertOrderStatusTransition };
