const {
  ORDER_TRANSITIONS,
  canTransitionOrderStatus,
  assertOrderStatusTransition
} = require('../services/orderStatusMachine');

describe('order status state machine', () => {
  test('defines the approved lifecycle', () => {
    expect(ORDER_TRANSITIONS).toEqual({
      PLACED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: []
    });
  });

  test('allows forward lifecycle and cancellation transitions', () => {
    expect(canTransitionOrderStatus('PLACED', 'PROCESSING')).toBe(true);
    expect(canTransitionOrderStatus('PLACED', 'CANCELLED')).toBe(true);
    expect(canTransitionOrderStatus('PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransitionOrderStatus('SHIPPED', 'DELIVERED')).toBe(true);
  });

  test('rejects backwards, skipped and terminal transitions', () => {
    expect(canTransitionOrderStatus('PLACED', 'SHIPPED')).toBe(false);
    expect(canTransitionOrderStatus('SHIPPED', 'PLACED')).toBe(false);
    expect(canTransitionOrderStatus('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransitionOrderStatus('CANCELLED', 'PROCESSING')).toBe(false);
  });

  test('throws a machine-readable error for invalid transitions', () => {
    expect(() => assertOrderStatusTransition('DELIVERED', 'PROCESSING')).toThrow(
      'Invalid order status transition: DELIVERED -> PROCESSING'
    );
    try {
      assertOrderStatusTransition('DELIVERED', 'PROCESSING');
    } catch (error) {
      expect(error.code).toBe('INVALID_ORDER_STATUS_TRANSITION');
    }
  });
});
