/**
 * In-memory stand-ins for the Mongo repositories, used by the unit tests so the
 * business rules (cart totals, stock reservation, idempotent checkout) can be
 * tested without a database (SRS NFR-005 / NFR-006).
 */
function createFakeBookRepo(books = []) {
  const store = new Map(books.map((b) => [b.id, { isActive: true, stock: 10, ...b }]));
  return {
    store,
    async findById(id) {
      const b = store.get(id);
      return b ? { ...b } : null;
    },
    async findByIds(ids) {
      return ids.map((id) => store.get(id)).filter(Boolean).map((b) => ({ ...b }));
    },
    async reserveStock(id, quantity) {
      const b = store.get(id);
      if (!b || !b.isActive || b.stock < quantity) return false;
      b.stock -= quantity;
      return true;
    },
    async releaseStock(id, quantity) {
      const b = store.get(id);
      if (b) b.stock += quantity;
    }
  };
}

function createFakeCartRepo() {
  const carts = new Map();
  return {
    carts,
    async findByCustomerId(customerId) {
      const c = carts.get(customerId);
      return c ? { customerId, items: c.items.map((i) => ({ ...i })) } : null;
    },
    async saveItems(customerId, items) {
      carts.set(customerId, { items: items.map((i) => ({ ...i })) });
      return { customerId, items: items.map((i) => ({ ...i })) };
    },
    async clear(customerId) {
      if (carts.has(customerId)) carts.get(customerId).items = [];
    }
  };
}

function createFakeOrderRepo() {
  const orders = [];
  function duplicate(field) {
    return Object.assign(new Error('duplicate key'), { duplicate: field });
  }
  return {
    orders,
    async create(data) {
      if (orders.some((o) => o.orderNumber === data.orderNumber)) throw duplicate('orderNumber');
      if (
        orders.some(
          (o) => o.customerId === data.customerId && o.idempotencyKey === data.idempotencyKey
        )
      ) {
        throw duplicate('idempotencyKey');
      }
      const order = { id: `order-${orders.length + 1}`, createdAt: new Date(), ...data };
      orders.push(order);
      return { ...order };
    },
    async findByCustomerAndKey(customerId, idempotencyKey) {
      const o = orders.find((x) => x.customerId === customerId && x.idempotencyKey === idempotencyKey);
      return o ? { ...o } : null;
    },
    // Same rules as the Mongo repository: confirmed orders only, owner only, newest first.
    async listByCustomer(customerId) {
      return orders
        .map((o, index) => ({ o, index }))
        .filter(({ o }) => o.customerId === customerId && o.paymentStatus === 'SUCCESS')
        .sort((a, b) => b.o.createdAt - a.o.createdAt || b.index - a.index)
        .map(({ o }) => ({ ...o }));
    },
    async findByIdForCustomer(customerId, orderId) {
      const o = orders.find(
        (x) => x.id === orderId && x.customerId === customerId && x.paymentStatus === 'SUCCESS'
      );
      return o ? { ...o, statusHistory: [...(o.statusHistory || [])] } : null;
    },
    async transitionStatus(customerId, orderId, fromStatus, toStatus, historyEntry) {
      const o = orders.find(
        (x) =>
          x.id === orderId &&
          x.customerId === customerId &&
          x.paymentStatus === 'SUCCESS' &&
          x.orderStatus === fromStatus
      );
      if (!o) return null;
      o.orderStatus = toStatus;
      o.statusHistory = [
        ...(o.statusHistory || []),
        { ...historyEntry, status: toStatus, previousStatus: fromStatus, newStatus: toStatus }
      ];
      return { ...o };
    }
  };
}

module.exports = { createFakeBookRepo, createFakeCartRepo, createFakeOrderRepo };
