import { useEffect, useMemo, useState } from 'react';
import { createShopApi } from '../../api/shopApi';
import { useCart } from '../../hooks/useCart';
import { describeError } from './errors';
import { formatMoney } from './format';
import './shop.css';

/**
 * Cart screen (SAD screen 3, FR-007, FR-008): edit quantities, remove items and see
 * the total. Every number shown comes from the server's cart response.
 *
 * Props
 *  api                  optional; defaults to createCartApi() (pass a fake in tests)
 *  onCheckout()         called by "Proceed to checkout" (opens the checkout screen)
 *  onContinueShopping() called from the empty cart
 *  onLogin()            called by "Log in" when the server answers 401
 *  currency             symbol put before prices (default "₹")
 */
function CartLine({ item, busy, onSetQuantity, onRemove, money }) {
  const [draft, setDraft] = useState(String(item.quantity));
  useEffect(() => setDraft(String(item.quantity)), [item.quantity]);

  const title = item.title || 'Unavailable book';
  const locked = busy || !item.available;

  function commit() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1) {
      setDraft(String(item.quantity)); // 0, negatives, decimals and blanks are never sent
      return;
    }
    if (n !== item.quantity) onSetQuantity(item.bookId, n);
  }

  let note = null;
  if (!item.available) note = 'No longer available. Remove it to continue.';
  else if (!item.inStock) note = 'Not enough copies in stock. Lower the quantity or remove it.';

  return (
    <li
      className={`cart-line${note ? ' cart-line--problem' : ''}`}
      aria-busy={busy ? 'true' : 'false'}
    >
      <div className="cart-line__info">
        <h2 className="cart-line__title">{title}</h2>
        <p className="cart-line__unit">{money(item.unitPrice)} each</p>
        {note && <p className="cart-line__note">{note}</p>}
      </div>

      <div className="cart-line__qty" role="group" aria-label={`Quantity for ${title}`}>
        <button
          type="button"
          className="cart-qty-btn"
          aria-label={`Decrease quantity of ${title}`}
          disabled={locked || item.quantity <= 1}
          onClick={() => onSetQuantity(item.bookId, item.quantity - 1)}
        >
          −
        </button>
        <input
          className="cart-qty-input"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          aria-label={`Quantity of ${title}`}
          value={draft}
          disabled={locked}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        <button
          type="button"
          className="cart-qty-btn"
          aria-label={`Increase quantity of ${title}`}
          disabled={locked}
          onClick={() => onSetQuantity(item.bookId, item.quantity + 1)}
        >
          +
        </button>
      </div>

      <p className="cart-line__subtotal" aria-label={`Subtotal for ${title}`}>
        {item.available ? money(item.subtotal) : '—'}
      </p>

      <button
        type="button"
        className="cart-line__remove"
        aria-label={`Remove ${title} from cart`}
        disabled={busy}
        onClick={() => onRemove(item.bookId)}
      >
        Remove
      </button>
    </li>
  );
}

export default function CartPage({
  api,
  onCheckout,
  onContinueShopping,
  onLogin,
  currency = '₹'
}) {
  const cartApi = useMemo(() => api || createShopApi(), [api]);
  const { cart, loading, error, busyBookId, reload, setQuantity, removeItem } = useCart(cartApi);

  const money = (value) => formatMoney(value, currency);

  const items = cart ? cart.items : [];
  const hasProblem = items.some((i) => !i.available || !i.inStock);

  const alert = error && (
    <div className="cart-alert" role="alert">
      <span>{describeError(error)}</span>
      {error.status === 401 && onLogin && (
        <button type="button" className="cart-link" onClick={onLogin}>
          Log in
        </button>
      )}
      {error.status !== 401 && !cart && (
        <button type="button" className="cart-link" onClick={reload}>
          Try again
        </button>
      )}
    </div>
  );

  let body;
  if (loading && !cart) {
    body = <p role="status" className="cart-status">Loading your cart…</p>;
  } else if (!cart) {
    body = alert; // first load failed (not logged in, or offline)
  } else if (items.length === 0) {
    body = (
      <>
        {alert}
        <div className="cart-empty">
          <p className="cart-empty__title">Your cart is empty.</p>
          <p>Find something to read and add it here.</p>
          {onContinueShopping && (
            <button type="button" className="cart-btn" onClick={onContinueShopping}>
              Continue shopping
            </button>
          )}
        </div>
      </>
    );
  } else {
    body = (
      <>
        {alert}
        <div className="cart-layout">
          <ul className="cart-lines">
            {items.map((item) => (
              <CartLine
                key={item.bookId}
                item={item}
                busy={busyBookId === item.bookId}
                onSetQuantity={setQuantity}
                onRemove={removeItem}
                money={money}
              />
            ))}
          </ul>

          <aside className="cart-summary" aria-label="Order summary">
            <h2 className="cart-summary__title">Summary</h2>
            <p className="cart-summary__row">
              <span>
                {cart.itemCount} {cart.itemCount === 1 ? 'title' : 'titles'}
              </span>
            </p>
            <p className="cart-summary__total">
              <span>Total</span>
              <strong data-testid="cart-total">{money(cart.total)}</strong>
            </p>
            {hasProblem && (
              <p className="cart-summary__hint">
                Fix the highlighted items before checking out.
              </p>
            )}
            <button
              type="button"
              className="cart-btn cart-btn--primary"
              disabled={hasProblem || busyBookId !== null}
              onClick={onCheckout}
            >
              Proceed to checkout
            </button>
          </aside>
        </div>
      </>
    );
  }

  return (
    <section className="cart" aria-labelledby="cart-title">
      <h1 id="cart-title" className="cart__title">Your cart</h1>
      {body}
    </section>
  );
}
