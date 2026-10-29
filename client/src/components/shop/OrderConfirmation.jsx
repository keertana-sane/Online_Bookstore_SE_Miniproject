import { formatMoney, STATUS_LABEL } from "./format";
import "./shop.css";

/**
 * Confirmation screen (SAD screen 5, FR-010): shown after a successful checkout with the
 * unique order number and the status PLACED.
 */
export default function OrderConfirmation({ order, address, onViewOrders, onContinueShopping }) {
  if (!order) return null;
  return (
    <section className="cart" aria-labelledby="confirm-title">
      <h1 id="confirm-title" className="cart__title">
        Thank you, your order is placed
      </h1>

      <div className="order-card" role="status">
        <p className="order-card__row">
          <span>Order number</span>
          <strong data-testid="order-number">{order.orderNumber}</strong>
        </p>
        <p className="order-card__row">
          <span>Status</span>
          <span className="order-badge order-badge--PLACED">
            {STATUS_LABEL[order.orderStatus] || order.orderStatus}
          </span>
        </p>
        <p className="order-card__row">
          <span>Payment</span>
          <span>{order.paymentStatus === "SUCCESS" ? "Paid (simulated)" : order.paymentStatus}</span>
        </p>
        {address && (
          <p className="order-card__row">
            <span>Ships to</span>
            <span className="order-card__address">{address}</span>
          </p>
        )}

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
          <strong>{formatMoney(order.total)}</strong>
        </p>
      </div>

      <div className="order-actions">
        <button type="button" className="cart-btn cart-btn--primary order-actions__main" onClick={onViewOrders}>
          View my orders
        </button>
        <button type="button" className="cart-btn" onClick={onContinueShopping}>
          Continue shopping
        </button>
      </div>
    </section>
  );
}
