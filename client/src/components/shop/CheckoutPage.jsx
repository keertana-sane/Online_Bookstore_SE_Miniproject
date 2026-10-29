import { useEffect, useMemo, useRef, useState } from "react";
import { createShopApi, newIdempotencyKey } from "../../api/shopApi";
import { describeCheckoutError, describeError } from "./errors";
import { formatMoney } from "./format";
import "./shop.css";

const MAX_ADDRESS = 300; // SRS Appendix B: shipping_address length 300

/**
 * Checkout screen (SAD screen 4, FR-009, FR-016, NFR-004): shipping address, a read-only
 * summary from the server's cart, and "Place order".
 *
 * One Idempotency-Key is made per order attempt and sent again when the customer retries
 * after a timeout or a lost connection, so a retry can never create a second order. After
 * a payment decline (which the server records) or a validation/stock error a new key is
 * made for the next attempt.
 *
 * Props
 *  api                  optional; defaults to createShopApi() (pass a fake in tests)
 *  onPlaced(order, address)  called once with the created order (201 or 200 replay)
 *  onBack()             back to the cart
 *  onLogin()            called when the server answers 401
 */
export default function CheckoutPage({ api, onPlaced, onBack, onLogin }) {
  const shop = useMemo(() => api || createShopApi(), [api]);
  const [cart, setCart] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState("");
  const keyRef = useRef(null);
  const sending = useRef(false); // blocks a double click before React re-renders

  useEffect(() => {
    let cancelled = false;
    shop
      .getCart()
      .then((c) => {
        if (!cancelled) setCart(c);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [shop]);

  const items = cart ? cart.items : [];
  const blocked = items.some((i) => !i.available || !i.inStock);
  const trimmed = address.trim();
  const addressProblem =
    trimmed.length === 0
      ? "Enter a shipping address."
      : trimmed.length > MAX_ADDRESS
        ? `The address must be ${MAX_ADDRESS} characters or fewer.`
        : "";
  const money = (v) => formatMoney(v);

  async function submit(event) {
    event.preventDefault();
    if (sending.current || !cart || items.length === 0 || blocked || addressProblem) return;
    sending.current = true;
    setSubmitting(true);
    setProblem("");
    if (!keyRef.current) keyRef.current = newIdempotencyKey();

    try {
      const order = await shop.placeOrder(trimmed, keyRef.current);
      keyRef.current = null;
      if (onPlaced) onPlaced(order, trimmed);
    } catch (err) {
      const titles = new Map(items.map((i) => [i.bookId, i.title]));
      const result = describeCheckoutError(err, (id) => titles.get(id) || "A book");
      if (!result.keepKey) keyRef.current = null;
      setProblem(result.text);
      if (err.status === 401 && onLogin) onLogin();
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  let body;
  if (loadError) {
    body = (
      <div className="cart-alert" role="alert">
        <span>{describeError(loadError)}</span>
        {loadError.status === 401 && onLogin && (
          <button type="button" className="cart-link" onClick={onLogin}>
            Log in
          </button>
        )}
      </div>
    );
  } else if (!cart) {
    body = (
      <p role="status" className="cart-status">
        Loading your order…
      </p>
    );
  } else if (items.length === 0) {
    body = (
      <div className="cart-empty">
        <p className="cart-empty__title">Your cart is empty.</p>
        <p>Add a book before checking out.</p>
        <button type="button" className="cart-btn" onClick={onBack}>
          Back to cart
        </button>
      </div>
    );
  } else {
    body = (
      <form className="cart-layout" onSubmit={submit} noValidate>
        <div className="checkout-main">
          <label className="checkout-label" htmlFor="shipping-address">
            Shipping address
          </label>
          <textarea
            id="shipping-address"
            className="checkout-address"
            rows={4}
            maxLength={MAX_ADDRESS + 50}
            value={address}
            disabled={submitting}
            onChange={(e) => setAddress(e.target.value)}
            aria-describedby="address-help"
            aria-invalid={address.length > 0 && addressProblem ? "true" : "false"}
            placeholder="House / street, city, PIN code"
          />
          <p id="address-help" className="checkout-help">
            {trimmed.length}/{MAX_ADDRESS} characters
            {address.length > 0 && addressProblem ? ` · ${addressProblem}` : ""}
          </p>

          <p className="checkout-note">
            Payment is simulated in this project. No card details are collected.
          </p>

          {problem && (
            <div className="cart-alert" role="alert">
              <span>{problem}</span>
              {problem.includes("Go back to your cart") && (
                <button type="button" className="cart-link" onClick={onBack}>
                  Back to cart
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="cart-summary" aria-label="Order summary">
          <h2 className="cart-summary__title">Order summary</h2>
          <ul className="summary-lines">
            {items.map((item) => (
              <li key={item.bookId}>
                <span>
                  {item.title || "Unavailable book"} × {item.quantity}
                </span>
                <span>{item.available ? money(item.subtotal) : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="cart-summary__total">
            <span>Total</span>
            <strong data-testid="checkout-total">{money(cart.total)}</strong>
          </p>
          {blocked && (
            <p className="cart-summary__hint">
              Some items are unavailable. Go back to the cart to fix them.
            </p>
          )}
          <button
            type="submit"
            className="cart-btn cart-btn--primary"
            disabled={submitting || blocked || Boolean(addressProblem)}
          >
            {submitting ? "Placing order…" : problem ? "Try again" : "Place order"}
          </button>
          <button type="button" className="cart-link checkout-back" onClick={onBack} disabled={submitting}>
            Back to cart
          </button>
        </aside>
      </form>
    );
  }

  return (
    <section className="cart" aria-labelledby="checkout-title">
      <h1 id="checkout-title" className="cart__title">
        Checkout
      </h1>
      {body}
    </section>
  );
}
