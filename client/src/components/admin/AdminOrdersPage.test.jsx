// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import AdminOrdersPage from "./AdminOrdersPage";
import { ApiError } from "../../api/shopApi";

afterEach(cleanup);

const order = (status = "PLACED") => ({
  orderId: "order-1",
  orderNumber: "ORD-20261029-00000001",
  orderStatus: status,
  total: 499,
  itemCount: 1,
  createdAt: "2026-10-29T09:30:00.000Z",
});

function fakeApi({ orders = [order()], updateError, onUpdate } = {}) {
  return {
    listAdminOrders: vi.fn(async () => ({ orders })),
    updateAdminOrderStatus: vi.fn(async (...args) => {
      if (updateError) throw updateError;
      if (onUpdate) return onUpdate(...args);
    }),
  };
}

describe("AdminOrdersPage", () => {
  it("lists incoming orders and filters by status", async () => {
    const api = fakeApi();
    render(<AdminOrdersPage api={api} />);
    expect(await screen.findByText("ORD-20261029-00000001")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "PROCESSING");
    await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith("PROCESSING"));
  });

  it("updates an order with a valid next status", async () => {
    const api = fakeApi();
    render(<AdminOrdersPage api={api} />);
    await screen.findByText("ORD-20261029-00000001");

    await userEvent.selectOptions(
      screen.getByLabelText("Update status for order ORD-20261029-00000001"),
      "PROCESSING",
    );
    await waitFor(() => expect(api.updateAdminOrderStatus).toHaveBeenCalledWith("order-1", "PROCESSING"));
  });

  it("shows invalid-transition API errors", async () => {
    const api = fakeApi({
      updateError: new ApiError(409, "INVALID_ORDER_STATUS_TRANSITION", "Invalid order status transition"),
    });
    render(<AdminOrdersPage api={api} />);
    await screen.findByText("ORD-20261029-00000001");

    await userEvent.selectOptions(
      screen.getByLabelText("Update status for order ORD-20261029-00000001"),
      "PROCESSING",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid order status transition");
  });

  it("shows an empty state", async () => {
    render(<AdminOrdersPage api={fakeApi({ orders: [] })} />);
    expect(await screen.findByText("No orders found")).toBeInTheDocument();
  });

  it("shows loading and then terminal-status information", async () => {
    const pending = {};
    pending.promise = new Promise((resolve) => { pending.resolve = resolve; });
    const api = {
      listAdminOrders: vi.fn(() => pending.promise),
      updateAdminOrderStatus: vi.fn(),
    };
    render(<AdminOrdersPage api={api} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading orders");

    pending.resolve({ orders: [order('DELIVERED')] });
    expect(await screen.findByText("No further status changes")).toBeInTheDocument();
  });

  it("shows list API failures and keeps unauthorized handling out of the customer UI", async () => {
    const onUnauthorized = vi.fn();
    const api = fakeApi();
    api.listAdminOrders = vi.fn(async () => {
      throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
    });
    render(<AdminOrdersPage api={api} onUnauthorized={onUnauthorized} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Administrator access required");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("logs out when an update returns unauthenticated", async () => {
    const onUnauthorized = vi.fn();
    const api = fakeApi({
      updateError: new ApiError(401, 'UNAUTHORIZED', 'Login required'),
    });
    render(<AdminOrdersPage api={api} onUnauthorized={onUnauthorized} />);
    await screen.findByText("ORD-20261029-00000001");

    await userEvent.selectOptions(
      screen.getByLabelText("Update status for order ORD-20261029-00000001"),
      "PROCESSING",
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });
});
