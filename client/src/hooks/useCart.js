import { useCallback, useEffect, useState } from 'react';

/**
 * Loads the cart and exposes the two edit actions. Every action asks the server
 * and then shows the cart the server sends back, so the total shown is always the
 * server-computed one (FR-008) and never calculated in the browser.
 */
export function useCart(api) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyBookId, setBusyBookId] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCart(await api.getCart());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(async (bookId, action) => {
    setBusyBookId(bookId);
    setError(null);
    try {
      setCart(await action());
    } catch (err) {
      setError(err);
    } finally {
      setBusyBookId(null);
    }
  }, []);

  const setQuantity = useCallback(
    (bookId, quantity) => run(bookId, () => api.updateQuantity(bookId, quantity)),
    [api, run]
  );
  const removeItem = useCallback(
    (bookId) => run(bookId, () => api.removeItem(bookId)),
    [api, run]
  );

  return { cart, loading, error, busyBookId, reload, setQuantity, removeItem };
}
