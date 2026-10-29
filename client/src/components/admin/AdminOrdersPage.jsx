import { useCallback, useEffect, useMemo, useState } from "react";
import { createShopApi } from "../../api/shopApi";
import { formatDate, formatMoney, STATUS_LABEL } from "../shop/format";
import "../shop/shop.css";

const STATUSES = ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const NEXT_STATUSES = {
  PLACED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export default function AdminOrdersPage({ api, onUnauthorized }) {
  const adminApi = useMemo(() => api || createShopApi(), [api]);
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminApi.listAdminOrders(status || undefined);
      setOrders(data.orders);
    } catch (e) {
      setError(e);
      setOrders(null);
      if (e.status === 401 && onUnauthorized) onUnauthorized();
    }
  }, [adminApi, onUnauthorized, status]);

  useEffect(() => {
    const request = Promise.resolve().then(load);
    return () => { void request.catch(() => {}); };
  }, [load]);

  async function updateStatus(order, nextStatus) {
    setUpdatingId(order.orderId);
    setNotice("");
    try {
      await adminApi.updateAdminOrderStatus(order.orderId, nextStatus);
      setNotice(`Order ${order.orderNumber} updated to ${STATUS_LABEL[nextStatus]}.`);
      await load();
    } catch (e) {
      setError(e);
      if (e.status === 401 && onUnauthorized) onUnauthorized();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="panel admin-orders-panel" aria-labelledby="admin-orders-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ORDER MANAGEMENT</p>
          <h1 id="admin-orders-heading">Orders</h1>
        </div>
        <button className="refresh-button" type="button" onClick={load} disabled={!orders && !error}>Refresh</button>
      </div>

      <label className="admin-filter" htmlFor="admin-order-status">
        Status
        <select id="admin-order-status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All orders</option>
          {STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
        </select>
      </label>

      {error && <p className="cart-alert" role="alert">{error.message || "Could not load orders."}</p>}
      {notice && <p className="order-notice" role="status">{notice}</p>}
      {!orders && !error && <p className="cart-status" role="status">Loading orders…</p>}
      {orders && orders.length === 0 && (
        <div className="cart-empty">
          <p className="cart-empty__title">No orders found</p>
          <p>{status ? `There are no ${STATUS_LABEL[status].toLowerCase()} orders.` : "Incoming orders will appear here."}</p>
        </div>
      )}
      {orders && orders.length > 0 && (
        <div className="admin-order-list">
          {orders.map((order) => {
            const choices = NEXT_STATUSES[order.orderStatus] || [];
            return (
              <article className="admin-order-card" key={order.orderId}>
                <div>
                  <p className="order-list__number">{order.orderNumber}</p>
                  <p className="order-list__meta">{order.itemCount} item{order.itemCount === 1 ? "" : "s"} · {formatMoney(order.total)}</p>
                  <p className="order-list__meta">Placed {formatDate(order.createdAt)}</p>
                </div>
                <span className={`order-badge order-badge--${order.orderStatus}`}>
                  {STATUS_LABEL[order.orderStatus] || order.orderStatus}
                </span>
                <label className="admin-order-update">
                  Update status
                  {choices.length > 0 ? (
                    <select aria-label={`Update status for order ${order.orderNumber}`} defaultValue="" disabled={updatingId === order.orderId}
                      onChange={(event) => { if (event.target.value) updateStatus(order, event.target.value); }}>
                      <option value="">Choose status</option>
                      {choices.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
                    </select>
                  ) : <span className="admin-terminal-status">No further status changes</span>}
                </label>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
