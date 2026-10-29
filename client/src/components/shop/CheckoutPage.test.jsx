// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import CheckoutPage from './CheckoutPage';
import OrderConfirmation from './OrderConfirmation';
import { ApiError } from '../../api/shopApi';

afterEach(cleanup);

const CART = {
  items: [
    { bookId: 'b1', title: 'Clean Code', unitPrice: 499, quantity: 2, subtotal: 998, available: true, inStock: true },
    { bookId: 'b2', title: 'The Pragmatic Programmer', unitPrice: 250.5, quantity: 1, subtotal: 250.5, available: true, inStock: true }
  ],
  itemCount: 2,
  total: 1248.5
};

const ORDER = {
  orderId: 'o1',
  orderNumber: 'ORD-20261029-AB12CD34',
  orderStatus: 'PLACED',
  paymentStatus: 'SUCCESS',
  total: 1248.5,
  items: [
    { bookId: 'b1', title: 'Clean Code', quantity: 2, unitPrice: 499 },
    { bookId: 'b2', title: 'The Pragmatic Programmer', quantity: 1, unitPrice: 250.5 }
  ]
};

/** Fake api: placeOrder answers from a queue; every call records [address, key]. */
function fakeApi({ cart = CART, results = [ORDER], cartError } = {}) {
  const placeCalls = [];
  const queue = [...results];
  return {
    placeCalls,
    getCart: async () => {
      if (cartError) throw cartError;
      return cart;
    },
    placeOrder: async (address, key) => {
      placeCalls.push([address, key]);
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    }
  };
}

const ADDRESS = '12 MG Road, Bengaluru 560001';

async function fillAddress(text = ADDRESS) {
  const box = await screen.findByLabelText('Shipping address');
  await userEvent.clear(box);
  await userEvent.type(box, text);
  return box;
}

describe('CheckoutPage', () => {
  it('shows the server total and the order lines', async () => {
    render(<CheckoutPage api={fakeApi()} />);
    expect(await screen.findByTestId('checkout-total')).toHaveTextContent('₹1,248.50');
    expect(screen.getByText('Clean Code × 2')).toBeInTheDocument();
    expect(screen.getByText('The Pragmatic Programmer × 1')).toBeInTheDocument();
  });

  it('will not place an order without an address', async () => {
    const api = fakeApi();
    render(<CheckoutPage api={api} />);
    const place = await screen.findByRole('button', { name: 'Place order' });
    expect(place).toBeDisabled();
    await userEvent.click(place);
    expect(api.placeCalls).toEqual([]);
  });

  it('accepts exactly 300 characters and rejects 301 (TC-ORD-03)', async () => {
    const api = fakeApi();
    render(<CheckoutPage api={api} />);
    await fillAddress('x'.repeat(301));
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(screen.getByText(/300 characters or fewer/i)).toBeInTheDocument();

    await fillAddress('x'.repeat(300));
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('places the order with a UUID key and hands the order to the confirmation', async () => {
    const api = fakeApi();
    let placed = null;
    render(<CheckoutPage api={api} onPlaced={(order, address) => (placed = { order, address })} />);

    await fillAddress(`  ${ADDRESS}  `);
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => expect(placed).not.toBeNull());
    expect(placed.order.orderNumber).toBe('ORD-20261029-AB12CD34');
    expect(placed.address).toBe(ADDRESS); // trimmed
    expect(api.placeCalls).toHaveLength(1);
    expect(api.placeCalls[0][0]).toBe(ADDRESS);
    expect(api.placeCalls[0][1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('after a timeout the retry sends the SAME key (NFR-004, TC-ORD-07)', async () => {
    const api = fakeApi({
      results: [new ApiError(504, 'PAYMENT_TIMEOUT', 'timeout'), ORDER]
    });
    let placed = null;
    render(<CheckoutPage api={api} onPlaced={(order) => (placed = order)} />);

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not answer in time.*not been charged/i);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(placed).not.toBeNull());

    expect(api.placeCalls).toHaveLength(2);
    expect(api.placeCalls[1][1]).toBe(api.placeCalls[0][1]);
  });

  it('after a decline the next try uses a NEW key and the cart is kept (TC-ORD-06)', async () => {
    const api = fakeApi({
      results: [new ApiError(402, 'PAYMENT_DECLINED', 'declined'), ORDER]
    });
    let placed = null;
    render(<CheckoutPage api={api} onPlaced={(order) => (placed = order)} />);

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/payment was declined.*cart is unchanged/i);
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('₹1,248.50');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(placed).not.toBeNull());

    expect(api.placeCalls[1][1]).not.toBe(api.placeCalls[0][1]);
  });

  it('a lost connection keeps the key, so the order cannot be created twice', async () => {
    const api = fakeApi({
      results: [new ApiError(0, 'NETWORK_ERROR', 'down'), ORDER]
    });
    render(<CheckoutPage api={api} onPlaced={() => {}} />);

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(api.placeCalls).toHaveLength(2));
    expect(api.placeCalls[1][1]).toBe(api.placeCalls[0][1]);
  });

  it('explains which book ran out of stock and links back to the cart (TC-ORD-08)', async () => {
    let backs = 0;
    const api = fakeApi({
      results: [
        new ApiError(409, 'OUT_OF_STOCK', 'Some books are out of stock', [
          { bookId: 'b2', requested: 1, available: 0 }
        ])
      ]
    });
    render(<CheckoutPage api={api} onBack={() => (backs += 1)} />);

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The Pragmatic Programmer is out of stock');
    await userEvent.click(within(alert).getByRole('button', { name: 'Back to cart' }));
    expect(backs).toBe(1);
  });

  it('blocks checkout when an item is no longer available', async () => {
    const cart = {
      ...CART,
      items: [{ ...CART.items[0], available: false, subtotal: 0 }]
    };
    render(<CheckoutPage api={fakeApi({ cart })} />);
    await fillAddress();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(screen.getByText(/some items are unavailable/i)).toBeInTheDocument();
  });

  it('shows an empty-cart message instead of the form', async () => {
    render(<CheckoutPage api={fakeApi({ cart: { items: [], itemCount: 0, total: 0 } })} />);
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Shipping address')).not.toBeInTheDocument();
  });

  it('asks the customer to log in on 401', async () => {
    let logins = 0;
    const api = fakeApi({ cartError: new ApiError(401, 'UNAUTHORIZED', 'Login required') });
    render(<CheckoutPage api={api} onLogin={() => (logins += 1)} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please log in to see your cart.');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(logins).toBe(1);
  });
});

describe('OrderConfirmation', () => {
  it('shows the unique order number, status PLACED and the total (TC-ORD-04, TC-ORD-10)', () => {
    render(<OrderConfirmation order={ORDER} address={ADDRESS} />);
    expect(screen.getByTestId('order-number')).toHaveTextContent('ORD-20261029-AB12CD34');
    expect(screen.getByText('Placed')).toBeInTheDocument();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(screen.getByText('₹1,248.50')).toBeInTheDocument();
  });

  it('links to order history and back to shopping', async () => {
    let history = 0;
    let shop = 0;
    render(
      <OrderConfirmation
        order={ORDER}
        onViewOrders={() => (history += 1)}
        onContinueShopping={() => (shop += 1)}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'View my orders' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));
    expect([history, shop]).toEqual([1, 1]);
  });
});
