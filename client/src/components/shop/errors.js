/** Plain-language messages for API errors, shared by the cart, checkout and order screens. */

function availableFrom(error) {
  const first = error.details && error.details[0];
  return first && typeof first.available === "number" ? first.available : null;
}

/** Cart screen errors (add, change quantity, remove). */
export function describeError(error) {
  if (!error) return "";
  if (error.status === 401) return "Please log in to see your cart.";
  if (error.status === 403) return "Only customer accounts have a cart.";
  if (error.code === "NETWORK_ERROR") {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (error.code === "OUT_OF_STOCK") {
    const available = availableFrom(error);
    if (available !== null) {
      return available === 0
        ? "That book is out of stock."
        : `Only ${available} ${available === 1 ? "copy is" : "copies are"} available.`;
    }
    return "Not enough stock for that quantity.";
  }
  if (error.code === "VALIDATION_ERROR" && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * Checkout errors (SAD API-09). `titleOf(bookId)` turns the book ids in an
 * OUT_OF_STOCK answer into titles. The result tells the screen whether the same
 * Idempotency-Key must be reused on the next try (`keepKey`): only when the outcome
 * of the request is unknown or known to have created nothing (timeout, network).
 */
export function describeCheckoutError(error, titleOf = () => "A book") {
  switch (error && error.code) {
    case "PAYMENT_DECLINED":
      return {
        text: "Your payment was declined. You have not been charged and your cart is unchanged. Please try again.",
        keepKey: false,
      };
    case "PAYMENT_TIMEOUT":
      return {
        text: "The payment service did not answer in time. You have not been charged. Please try again.",
        keepKey: true,
      };
    case "NETWORK_ERROR":
      return {
        text: "Could not reach the server. Your order may not have gone through; please try again and you will not be charged twice.",
        keepKey: true,
      };
    case "CART_EMPTY":
      return { text: "Your cart is empty, so there is nothing to order.", keepKey: false };
    case "OUT_OF_STOCK": {
      const lines = (error.details || [])
        .map((d) => {
          const left = typeof d.available === "number" ? d.available : null;
          return left === null
            ? `${titleOf(d.bookId)} is no longer available in that quantity`
            : left === 0
              ? `${titleOf(d.bookId)} is out of stock`
              : `only ${left} of ${titleOf(d.bookId)} left`;
        })
        .join("; ");
      return {
        text: `Some books are not available any more${lines ? ` (${lines})` : ""}. Go back to your cart and change the quantities.`,
        keepKey: false,
      };
    }
    case "VALIDATION_ERROR":
      return { text: error.message, keepKey: false };
    case "UNAUTHORIZED":
      return { text: "Please log in to place an order.", keepKey: true };
    default:
      return { text: "Something went wrong. Please try again.", keepKey: true };
  }
}

/** Order history, detail and cancel errors (SAD API-10 to API-12). */
export function describeOrderError(error) {
  if (!error) return "";
  if (error.status === 401) return "Please log in to see your orders.";
  if (error.status === 403) return "Only customer accounts have orders.";
  if (error.code === "NETWORK_ERROR") {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (error.code === "ORDER_NOT_FOUND") return "We could not find that order.";
  if (error.code === "CANCEL_NOT_ALLOWED") {
    return "This order can no longer be cancelled because it is already being processed.";
  }
  return "Something went wrong. Please try again.";
}
