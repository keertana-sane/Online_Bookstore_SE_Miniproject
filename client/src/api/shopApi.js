/**
 * Client for the cart endpoints (SAD API-05 to API-08). The JWT is read from
 * browser session storage and sent as "Authorization: Bearer <token>" (SAD C-01).
 *
 * Errors use the standard envelope { error: { code, message, details } } and are
 * thrown as ApiError so screens can react to the code (OUT_OF_STOCK, 401, ...).
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ASSUMPTION: the login screen stores the token under the key "token".
// If the Auth module (BK-06) uses another key, change it here or pass getToken.
export const TOKEN_KEY = 'token';

function readToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch (err) {
    return null; // storage can be blocked (private mode)
  }
}

export function createCartApi({ baseUrl = '/api/v1', getToken = readToken, fetchImpl } = {}) {
  async function request(method, path, body) {
    const doFetch = fetchImpl || fetch;
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (err) {
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
    }

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }

    if (!response.ok) {
      const e = (data && data.error) || {};
      throw new ApiError(
        response.status,
        e.code || (response.status === 401 ? 'UNAUTHORIZED' : 'ERROR'),
        e.message || 'Something went wrong',
        e.details
      );
    }
    return data;
  }

  const id = encodeURIComponent;
  return {
    getCart: () => request('GET', '/cart'),
    // Also used by the catalog's "Add to cart" button (BK-13).
    addItem: (bookId, quantity = 1) => request('POST', '/cart/items', { bookId, quantity }),
    updateQuantity: (bookId, quantity) =>
      request('PATCH', `/cart/items/${id(bookId)}`, { quantity }),
    removeItem: (bookId) => request('DELETE', `/cart/items/${id(bookId)}`)
  };
}
