// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import CartPage from './CartPage';
import { ApiError } from '../../api/cartApi';

afterEach(cleanup);

/** Builds the cart shape the server returns (SAD "Other contract rules"). */
function cartOf(lines) {
  const items = lines.map((l) => ({
    bookId: l.bookId,
    title: l.title,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    subtotal: l.available === false ? 0 : l.unitPrice * l.quantity,
    available: l.available !== false,
    inStock: l.inStock !== false
  }));
  return {
    items,
    itemCount: items.length,
    total: items.reduce((sum, i) => sum + i.subtotal, 0)
  };
}

const ONE = { bookId: 'b1', title: 'Clean Code', unitPrice: 499, quantity: 2 };
const TWO = { bookId: 'b2', title: 'The Pragmatic Programmer', unitPrice: 250.5, quantity: 1 };

/** Fake api: records calls and answers from a queue or a function. */
function fakeApi({ initial, onUpdate, onRemove, getCartError } = {}) {
  const calls = { update: [], remove: [], get: 0 };
  return {
    calls,
    getCart: async () => {
      calls.get += 1;
      if (getCartError) throw getCartError;
      return initial;
    },
    updateQuantity: async (bookId, quantity) => {
      calls.update.push([bookId, quantity]);
      return onUpdate(bookId, quantity);
    },
    removeItem: async (bookId) => {
      calls.remove.push(bookId);
      return onRemove(bookId);
    }
  };
}

describe('CartPage', () => {
  it('shows each line with its subtotal and the server total', async () => {
    const api = fakeApi({ initial: cartOf([ONE, TWO]) });
    render(<CartPage api={api} />);

    expect(await screen.findByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText('The Pragmatic Programmer')).toBeInTheDocument();
    expect(screen.getByLabelText('Subtotal for Clean Code')).toHaveTextContent('₹998.00');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('₹1,248.50'); // 2 x 499 + 250.50
  });

  it('shows a friendly empty cart with a way back to the catalog', async () => {
    let went = 0;
    const api = fakeApi({ initial: cartOf([]) });
    render(<CartPage api={api} onContinueShopping={() => { went += 1; }} />);

    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));
    expect(went).toBe(1);
    expect(screen.queryByRole('button', { name: /checkout/i })).not.toBeInTheDocument();
  });

  it('increases the quantity and shows the new total from the server', async () => {
    const api = fakeApi({
      initial: cartOf([ONE]),
      onUpdate: async (id, q) => cartOf([{ ...ONE, quantity: q }])
    });
    render(<CartPage api={api} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Clean Code' }));

    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent('₹1,497.00'));
    expect(api.calls.update).toEqual([['b1', 3]]);
    expect(screen.getByLabelText('Quantity of Clean Code')).toHaveValue(3);
  });

  it('cannot decrease below 1 (use Remove instead)', async () => {
    const api = fakeApi({ initial: cartOf([{ ...ONE, quantity: 1 }]) });
    render(<CartPage api={api} />);
    expect(await screen.findByRole('button', { name: 'Decrease quantity of Clean Code' })).toBeDisabled();
  });

  it('typing a quantity and pressing Enter sends it once', async () => {
    const api = fakeApi({
      initial: cartOf([ONE]),
      onUpdate: async (id, q) => cartOf([{ ...ONE, quantity: q }])
    });
    render(<CartPage api={api} />);

    const input = await screen.findByLabelText('Quantity of Clean Code');
    await userEvent.clear(input);
    await userEvent.type(input, '4{Enter}');

    await waitFor(() => expect(api.calls.update).toEqual([['b1', 4]]));
  });

  it.each(['0', '-1', '1.5', ''])('never sends the invalid quantity "%s"', async (text) => {
    const api = fakeApi({ initial: cartOf([ONE]) });
    render(<CartPage api={api} />);

    const input = await screen.findByLabelText('Quantity of Clean Code');
    await userEvent.clear(input);
    if (text) await userEvent.type(input, text);
    await userEvent.tab(); // blur commits

    expect(api.calls.update).toEqual([]);
    expect(input).toHaveValue(2); // back to the real quantity
  });

  it('removes an item and updates the total', async () => {
    const api = fakeApi({
      initial: cartOf([ONE, TWO]),
      onRemove: async () => cartOf([TWO])
    });
    render(<CartPage api={api} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Clean Code from cart' }));

    await waitFor(() => expect(screen.queryByText('Clean Code')).not.toBeInTheDocument());
    expect(api.calls.remove).toEqual(['b1']);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('₹250.50');
  });

  it('explains when there is not enough stock and keeps the old quantity', async () => {
    const api = fakeApi({
      initial: cartOf([ONE]),
      onUpdate: async () => {
        throw new ApiError(409, 'OUT_OF_STOCK', 'Not enough stock for this book', [
          { bookId: 'b1', requested: 3, available: 2 }
        ]);
      }
    });
    render(<CartPage api={api} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Clean Code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only 2 copies are available.');
    expect(screen.getByLabelText('Quantity of Clean Code')).toHaveValue(2);
  });

  it('flags a book that is no longer available and blocks checkout until it is removed', async () => {
    let checkouts = 0;
    const gone = { bookId: 'b9', title: 'Old Edition', unitPrice: 100, quantity: 1, available: false };
    const api = fakeApi({
      initial: cartOf([ONE, gone]),
      onRemove: async () => cartOf([ONE])
    });
    render(<CartPage api={api} onCheckout={() => { checkouts += 1; }} />);

    const checkout = await screen.findByRole('button', { name: 'Proceed to checkout' });
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(checkout).toBeDisabled();
    expect(screen.getByLabelText('Quantity of Old Edition')).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Old Edition from cart' }));
    await waitFor(() => expect(checkout).toBeEnabled());
    await userEvent.click(checkout);
    expect(checkouts).toBe(1);
  });

  it('asks the customer to log in when the server answers 401', async () => {
    let logins = 0;
    const api = fakeApi({ getCartError: new ApiError(401, 'UNAUTHORIZED', 'Login required') });
    render(<CartPage api={api} onLogin={() => { logins += 1; }} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please log in to see your cart.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Log in' }));
    expect(logins).toBe(1);
  });

  it('shows a retry when the server cannot be reached, then recovers', async () => {
    let fail = true;
    const api = {
      getCart: async () => {
        if (fail) throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
        return cartOf([ONE]);
      }
    };
    render(<CartPage api={api} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Clean Code')).toBeInTheDocument();
  });

  it('proceed to checkout calls onCheckout', async () => {
    let checkouts = 0;
    const api = fakeApi({ initial: cartOf([ONE]) });
    render(<CartPage api={api} onCheckout={() => { checkouts += 1; }} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Proceed to checkout' }));
    expect(checkouts).toBe(1);
  });
});
