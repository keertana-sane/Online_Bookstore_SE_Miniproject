/** Money and date formatting shared by the cart, checkout and order screens. */
export function formatMoney(value, currency = "₹") {
  return `${currency}${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/** Plain-words status for the customer. */
export const STATUS_LABEL = {
  PLACED: "Placed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
