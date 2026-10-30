# BK-33: Usability Walkthrough — Place an Order in Five Screens

**Project:** Team 15 — Online Bookstore  
**Ticket:** BK-33  
**Goal:** Verify that a signed-in customer can place an order in no more than five application screens.

## 1. Scope

This walkthrough covers the customer journey from browsing the catalog to viewing the successful order confirmation.

The customer must be signed in with a customer account before adding books to the cart. A guest may need to complete the sign-in flow first; authentication is treated as a prerequisite and is not counted in the four-screen shopping journey below.

## 2. User Journey

| Step | Screen | User action | Expected result |
|---|---|---|---|
| 1 | Catalog | Browse available books and select **Add to cart**. | The book is added to the customer's cart and feedback confirms the action. |
| 2 | Cart | Review the cart, adjust quantities if needed, and select checkout. | The cart displays its contents and server-calculated total. |
| 3 | Checkout | Enter a valid shipping address and place the order. | The server processes the order using the simulated payment adapter. |
| 4 | Order confirmation | Review the order number and status. | The successful order is displayed with status `PLACED`. |

**Total shopping screens: 4.** The journey is within the five-screen limit, provided the walkthrough confirms the expected behavior in the running application.

## 3. Preconditions

- The application and database are running.
- A customer account is available.
- The customer is signed in.
- At least one active book has stock available.
- The payment adapter is configured for its default successful outcome.

## 4. Test Procedure

1. Open the bookstore catalog while signed in.
2. Choose an in-stock book and select **Add to cart**.
3. Open the cart and verify the book, quantity, and total.
4. Proceed to checkout.
5. Enter a valid shipping address and submit the order once.
6. Verify that the confirmation screen displays an order number and status `PLACED`.

## 5. Acceptance Criteria

- [ ] An in-stock book can be added to the cart.
- [ ] The cart shows the selected book and the correct server-calculated total.
- [ ] Checkout accepts a valid shipping address.
- [ ] A successful checkout displays an order number and `PLACED` status.
- [ ] The shopping journey uses no more than five screens.
- [ ] Screenshots are captured as evidence of the completed walkthrough.

## 6. Evidence

Record the manual test result and attach screenshots showing the catalog, cart, checkout, and order confirmation.

**Execution date:** ____________________

**Result:** Pending manual walkthrough.

**Issues observed:** ____________________

## 7. Notes and Limitations

This document describes the intended four-screen shopping journey based on the application's current view structure and cart/checkout documentation. The acceptance criteria must be verified manually in the running application before the ticket is marked fully tested.

Authentication may require an additional sign-in dialog or interaction for a guest user. The four-screen count applies to a customer who is already signed in.