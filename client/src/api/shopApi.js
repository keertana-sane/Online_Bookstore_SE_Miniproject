import { TOKEN_KEY } from "./authApi.js";

/**
 * Client for the cart and order endpoints (SAD API-05 to API-12). The JWT is read
 * from browser session storage and sent as "Authorization: Bearer <token>" (SAD C-01).
 *
 * Errors use the standard envelope { error: { code, message, details } } and are
 * thrown as ApiError so screens can react to the code (OUT_OF_STOCK, 401, ...).
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_BASE_URL =
  import.meta.env?.VITE_AUTH_API_URL || "http://localhost:5000/api/v1";

function readToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage can be blocked (private mode)
  }
}

/** A fresh Idempotency-Key for one checkout attempt (SAD ADR-03). */
export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Very old browsers: build a version-4 UUID from random numbers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createShopApi({
  baseUrl = DEFAULT_BASE_URL,
  getToken = readToken,
  fetchImpl,
} = {}) {
  async function request(method, path, { body, headers: extra } = {}) {
    const doFetch = fetchImpl || fetch;
    const headers = { Accept: "application/json", ...extra };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const e = (data && data.error) || {};
      throw new ApiError(
        response.status,
        e.code || (response.status === 401 ? "UNAUTHORIZED" : "ERROR"),
        e.message || "Something went wrong",
        e.details
      );
    }
    return data;
  }

  const id = encodeURIComponent;
  return {
    // Cart (API-05 to API-08)
    getCart: () => request("GET", "/cart"),
    addItem: (bookId, quantity = 1) =>
      request("POST", "/cart/items", { body: { bookId, quantity } }),
    updateQuantity: (bookId, quantity) =>
      request("PATCH", `/cart/items/${id(bookId)}`, { body: { quantity } }),
    removeItem: (bookId) => request("DELETE", `/cart/items/${id(bookId)}`),

    // Orders (API-09 to API-12). The same idempotencyKey must be sent again when a
    // checkout is retried after a timeout, so a retry can never create a second order.
    placeOrder: (shippingAddress, idempotencyKey) =>
      request("POST", "/orders", {
        body: { shippingAddress },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    listOrders: () => request("GET", "/orders"),
    getOrder: (orderId) => request("GET", `/orders/${id(orderId)}`),
    cancelOrder: (orderId) => request("PATCH", `/orders/${id(orderId)}/cancel`),

    // Administrator order management (FR-015)
    listAdminOrders: (status) => {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      return request("GET", `/admin/orders${query}`);
    },
    updateAdminOrderStatus: (orderId, status) =>
      request("PATCH", `/admin/orders/${id(orderId)}/status`, { body: { status } }),
  };
}
