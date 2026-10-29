import { useCallback, useEffect, useMemo, useState } from "react";
import { createShopApi } from "../../api/shopApi";
import { describeOrderError } from "./errors";
import { formatDate, formatMoney, STATUS_LABEL } from "./format";
import "./shop.css";

function StatusBadge({ status }) {
  return (
    <span className={`order-badge order-badge--${status}`}>{STATUS_LABEL[status] || status}</span>
  );
}

function OrderDetail({ api, orderId, onBack, onChanged }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setOrder(await api.getOrder(orderId));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [api, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel() {
    setCancelling(true);
    setNotice("");
    try {
      setOrder(await api.cancelOrder(orderId));
      setError(null);
      setNotice("Your order was cancelled and the books were returned to stock.");
      if (onChanged) onChanged();
    } catch (e) {
      if (e.code === "CANCEL_NOT_ALLOWED") await load(); // show the real, newer status
      setError(e);
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <div>
      <button type="button" className="cart-link" onClick={onBack}>
        ← All orders
      </button>

      {error && (
        <div className="cart-alert" role="alert">
          <span>{describeOrderError(error)}</span>
        </div>
      )}
      {notice && (
        <p className="order-notice" role="status">
          {notice}
        </p>
      )}

      {!order && !error && (
        <p role="status" className="cart-status">
          Loading order…
        </p>
      )}

      {order && (
        <article className="order-card" aria-label={`Order ${order.orderNumber}`}>
          <h2 className="order-card__title">Order {order.orderNumber}</h2>
          <p className="order-card__row">
            <span>Status</span>
            <StatusBadge status={order.orderStatus} />
          </p>
          <p className="order-card__row">
            <span>Placed on</span>
            <span>{formatDate(order.createdAt)}</span>
          </p>
          <p className="order-card__row">
            <span>Ships to</span>
            <span className="order-card__address">{order.shippingAddress}</span>
          </p>

          <ul className="summary-lines">
            {order.items.map((item) => (
              <li key={item.bookId}>
                <span>
                  {item.title} × {item.quantity}
                </span>
                <span>{formatMoney(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="cart-summary__total">
            <span>Total</span>
            <strong data-testid="order-total">{formatMoney(order.total)}</strong>
          </p>

          <h3 className="order-card__sub">History</h3>
          <ol className="order-history">
            {order.statusHistory.map((h, i) => (
              <li key={`${h.status}-${i}`}>
                <StatusBadge status={h.status} /> <span>{formatDate(h.at)}</span>
                {h.by === "you" ? " · by you" : h.by === "staff" ? " · by staff" : ""}
              </li>
            ))}
          </ol>

          {order.orderStatus === "PLACED" && !confirming && (
            <button type="button" className="cart-btn order-cancel" onClick={() => setConfirming(true)}>
              Cancel order
            </button>
          )}
          {order.orderStatus === "PLACED" && confirming && (
            <div className="order-confirm" role="group" aria-label="Confirm cancellation">
              <p>Cancel this order? The books go back to stock.</p>
              <button type="button" className="cart-btn order-cancel" disabled={cancelling} onClick={cancel}>
                {cancelling ? "Cancelling…" : "Yes, cancel order"}
              </button>
              <button type="button" className="cart-link" disabled={cancelling} onClick={() => setConfirming(false)}>
                Keep order
              </button>
            </div>
          )}
          {order.orderStatus !== "PLACED" && order.orderStatus !== "CANCELLED" && (
            <p className="checkout-help">This order is already being processed and can no longer be cancelled.</p>
          )}
        </article>
      )}
    </div>
  );
}

/**
 * Order history and order detail (SAD screens 5 and 6, FR-011, FR-012, business rule 6.5).
 * Lists the customer's own orders, newest first; opening one shows items, total, status
 * history and, while the order is PLACED, a Cancel button.
 *
 * Props: api (optional, for tests), onContinueShopping(), onLogin()
 */
export default function OrdersPage({ api, onContinueShopping, onLogin }) {
  const shop = useMemo(() => api || createShopApi(), [api]);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await shop.listOrders();
      setOrders(data.orders);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [shop]);

  useEffect(() => {
    load();
  }, [load]);

  let body;
  if (openId) {
    body = (
      <OrderDetail
        api={shop}
        orderId={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
        onChanged={load}
      />
    );
  } else if (error) {
    body = (
      <div className="cart-alert" role="alert">
        <span>{describeOrderError(error)}</span>
        {error.status === 401 && onLogin && (
          <button type="button" className="cart-link" onClick={onLogin}>
            Log in
          </button>
        )}
        {error.status !== 401 && (
          <button type="button" className="cart-link" onClick={load}>
            Try again
          </button>
        )}
      </div>
    );
  } else if (!orders) {
    body = (
      <p role="status" className="cart-status">
        Loading your orders…
      </p>
    );
  } else if (orders.length === 0) {
    body = (
      <div className="cart-empty">
        <p className="cart-empty__title">No orders yet</p>
        <p>When you place an order it will show up here.</p>
        {onContinueShopping && (
          <button type="button" className="cart-btn" onClick={onContinueShopping}>
            Browse books
          </button>
        )}
      </div>
    );
  } else {
    body = (
      <ul className="order-list">
        {orders.map((o) => (
          <li key={o.orderId} className="order-list__item">
            <div>
              <p className="order-list__number">{o.orderNumber}</p>
              <p className="order-list__meta">
                {formatDate(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? "book" : "books"}
              </p>
            </div>
            <StatusBadge status={o.orderStatus} />
            <strong>{formatMoney(o.total)}</strong>
            <button
              type="button"
              className="cart-btn"
              aria-label={`View order ${o.orderNumber}`}
              onClick={() => setOpenId(o.orderId)}
            >
              View
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="cart" aria-labelledby="orders-title">
      <h1 id="orders-title" className="cart__title">
        My orders
      </h1>
      {body}
    </section>
  );
}
