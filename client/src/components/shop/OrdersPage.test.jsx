// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import OrdersPage from './OrdersPage';
import { ApiError } from '../../api/shopApi';

afterEach(cleanup);

const summary = (n, status, total, itemCount = 2) => ({
  orderId: `o${n}`,
  orderNumber: `ORD-20261029-0000000${n}`,
  orderStatus: status,
  paymentStatus: 'SUCCESS',
  total,
  itemCount,
  createdAt: '2026-10-29T09:30:00.000Z'
});

const detail = (n, status = 'PLACED', extraHistory = []) => ({
  ...summary(n, status, 1248.5),
  shippingAddress: '12 MG Road, Bengaluru 560001',
  items: [
    { bookId: 'b1', title: 'Clean Code', quantity: 2, unitPrice: 499 },
    { bookId: 'b2', title: 'The Pragmatic Programmer', quantity: 1, unitPrice: 250.5 }
  ],
  statusHistory: [
    { status: 'PLACED', at: '2026-10-29T09:30:00.000Z', by: 'you' },
    ...extraHistory
  ]
});

function fakeApi({ orders = [], orderById = {}, listError, onCancel } = {}) {
  const calls = { cancel: [], get: [], list: 0 };
  return {
    calls,
    listOrders: async () => {
      calls.list += 1;
      if (listError) throw listError;
      return { orders };
    },
    getOrder: async (id) => {
      calls.get.push(id);
      if (!orderById[id]) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
      return orderById[id];
    },
    cancelOrder: async (id) => {
      calls.cancel.push(id);
      return onCancel(id);
    }
  };
}

describe('OrdersPage: history', () => {
  it('lists the orders in the order the server sends (newest first) with status and total (TC-TRK-01)', async () => {
    const api = fakeApi({
      orders: [summary(3, 'PLACED', 998), summary(2, 'CANCELLED', 250.5, 1), summary(1, 'DELIVERED', 499, 1)]
    });
    render(<OrdersPage api={api} />);

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('ORD-20261029-00000003');
    expect(rows[0]).toHaveTextContent('Placed');
    expect(rows[0]).toHaveTextContent('₹998.00');
    expect(rows[0]).toHaveTextContent('2 books');
    expect(rows[1]).toHaveTextContent('Cancelled');
    expect(rows[1]).toHaveTextContent('1 book');
    expect(rows[2]).toHaveTextContent('Delivered');
  });

  it("says 'No orders yet' when the list is empty (TC-TRK-07)", async () => {
    let browsed = 0;
    render(<OrdersPage api={fakeApi()} onContinueShopping={() => (browsed += 1)} />);
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Browse books' }));
    expect(browsed).toBe(1);
  });

  it('asks the customer to log in when the server answers 401 (TC-TRK-08)', async () => {
    let logins = 0;
    const api = fakeApi({ listError: new ApiError(401, 'UNAUTHORIZED', 'Login required') });
    render(<OrdersPage api={api} onLogin={() => (logins += 1)} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please log in to see your orders.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Log in' }));
    expect(logins).toBe(1);
  });

  it('offers a retry when the server cannot be reached', async () => {
    const api = fakeApi({ listError: new ApiError(0, 'NETWORK_ERROR', 'down') });
    render(<OrdersPage api={api} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.calls.list).toBe(2));
  });
});

describe('OrdersPage: detail and cancel', () => {
  async function openFirst(api) {
    render(<OrdersPage api={api} />);
    await userEvent.click(await screen.findByRole('button', { name: /View order ORD-20261029-00000001/ }));
  }

  it('shows items, total, address and status history (TC-TRK-02)', async () => {
    const api = fakeApi({ orders: [summary(1, 'PLACED', 1248.5)], orderById: { o1: detail(1) } });
    await openFirst(api);

    expect(await screen.findByText('Order ORD-20261029-00000001')).toBeInTheDocument();
    expect(screen.getByText('Clean Code × 2')).toBeInTheDocument();
    expect(screen.getByText('12 MG Road, Bengaluru 560001')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent('₹1,248.50');
    expect(screen.getByText(/by you/)).toBeInTheDocument();
  });

  it('cancels a PLACED order after a confirmation step (TC-TRK-05)', async () => {
    const cancelled = detail(1, 'CANCELLED', [{ status: 'CANCELLED', at: '2026-10-29T10:00:00.000Z', by: 'you' }]);
    const api = fakeApi({
      orders: [summary(1, 'PLACED', 1248.5)],
      orderById: { o1: detail(1) },
      onCancel: async () => cancelled
    });
    await openFirst(api);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(api.calls.cancel).toEqual([]); // nothing sent until confirmed
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel order' }));

    expect(await screen.findByText(/order was cancelled and the books were returned to stock/i)).toBeInTheDocument();
    expect(api.calls.cancel).toEqual(['o1']);
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  it('"Keep order" backs out without cancelling', async () => {
    const api = fakeApi({ orders: [summary(1, 'PLACED', 1248.5)], orderById: { o1: detail(1) } });
    await openFirst(api);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep order' }));
    expect(api.calls.cancel).toEqual([]);
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
  });

  it.each(['PROCESSING', 'SHIPPED', 'DELIVERED'])(
    'offers no Cancel button once the order is %s (TC-TRK-06)',
    async (status) => {
      const api = fakeApi({ orders: [summary(1, status, 1248.5)], orderById: { o1: detail(1, status) } });
      await openFirst(api);

      expect(await screen.findByText(/can no longer be cancelled/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    }
  );

  it('shows the real status when staff moved the order on before the customer cancelled', async () => {
    let status = 'PLACED';
    const api = {
      listOrders: async () => ({ orders: [summary(1, status, 1248.5)] }),
      getOrder: async () => detail(1, status),
      cancelOrder: async () => {
        status = 'PROCESSING'; // staff updated the order in the meantime
        throw new ApiError(409, 'CANCEL_NOT_ALLOWED', 'no');
      }
    };
    await openFirst(api);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already being processed/i);
    await waitFor(() => expect(screen.getByText('Processing')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('going back refreshes the list', async () => {
    const api = fakeApi({ orders: [summary(1, 'PLACED', 1248.5)], orderById: { o1: detail(1) } });
    await openFirst(api);
    await screen.findByText('Order ORD-20261029-00000001');
    await userEvent.click(screen.getByRole('button', { name: '← All orders' }));
    await waitFor(() => expect(api.calls.list).toBe(2));
    expect(await screen.findByText('ORD-20261029-00000001')).toBeInTheDocument();
  });
});
