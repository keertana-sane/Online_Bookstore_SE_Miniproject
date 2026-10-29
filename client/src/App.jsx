
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import AuthDialog from "./components/AuthDialog.jsx";
import { TOKEN_KEY } from "./api/authApi.js";
import { createShopApi } from "./api/shopApi.js";
import CartPage from "./components/shop/CartPage.jsx";
import CheckoutPage from "./components/shop/CheckoutPage.jsx";
import OrderConfirmation from "./components/shop/OrderConfirmation.jsx";
import OrdersPage from "./components/shop/OrdersPage.jsx";
import { describeError } from "./components/shop/errors.js";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AUTH_EMAIL_KEY = "userEmail";
const AUTH_ROLE_KEY = "userRole";
const PAGE_SIZE = 20;
const shopApi = createShopApi(); // cart and order calls (SAD API-05 to API-12)

const EMPTY_FORM = {
  title: "",
  author: "",
  price: "",
  category: "",
  stock: "",
};

function App() {
  const [authUser, setAuthUser] = useState(() => {
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    return {
      email: window.sessionStorage.getItem(AUTH_EMAIL_KEY) || "",
      role: window.sessionStorage.getItem(AUTH_ROLE_KEY) || "",
    };
  });
  const [authDialogMode, setAuthDialogMode] = useState(null);
  // Which screen is open: "catalog" | "cart" | "checkout" | "confirmation" | "orders".
  const [view, setView] = useState("catalog");
  const [placed, setPlaced] = useState(null); // { order, address } after a successful checkout
  const [cartFeedback, setCartFeedback] = useState(null); // { bookId, text, isError }
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalBooks: 0,
    totalPages: 0,
    totalStock: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  // BK-12: Individual book details.
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const titleInputRef = useRef(null);

  // BK-10 + BK-11: Paginated catalog and backend search.
  const loadBooks = useCallback(async (requestedPage = 1, searchTerm = "") => {
    setRefreshing(true);

    try {
      setError("");

      const params = new URLSearchParams({
        page: String(requestedPage),
        limit: String(PAGE_SIZE),
        search: searchTerm.trim(),
      });

      const response = await fetch(`${API_URL}/books?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load books.");
      }

      const catalog = Array.isArray(data) ? data : data.books;

      if (!Array.isArray(catalog)) {
        throw new Error("Unexpected response from the bookstore API.");
      }

      setBooks(
        catalog.map((book) => ({
          ...book,
          stock: book.stock ?? book.stock_quantity ?? 0,
          active: book.active ?? book.is_active ?? true,
        }))
      );

      if (data.pagination) {
        setPagination({
          page: data.pagination.page ?? requestedPage,
          limit: data.pagination.limit ?? PAGE_SIZE,
          totalBooks: data.pagination.totalBooks ?? catalog.length,
          totalPages: data.pagination.totalPages ?? 0,
          totalStock: data.pagination.totalStock ?? 0,
        });
      } else {
        setPagination({
          page: 1,
          limit: catalog.length,
          totalBooks: catalog.length,
          totalPages: catalog.length > 0 ? 1 : 0,
          totalStock: catalog.reduce(
            (sum, book) =>
              sum + Number(book.stock ?? book.stock_quantity ?? 0),
            0
          ),
        });
      }
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the bookstore API. Check that the backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadBooks(1, search), 300);
    return () => clearTimeout(timer);
  }, [loadBooks, search]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  }

  function handleAddButton() {
    resetForm();
    setError("");
    setMessage("");

    document
      .getElementById("book-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    titleInputRef.current?.focus();
  }

  // Add or edit a book.
  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setError("");
    setMessage("");

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      price: Number(form.price),
      category: form.category.trim(),
      stock: Number(form.stock),
    };

    if (
      !payload.title ||
      !payload.author ||
      !payload.category ||
      form.price.trim() === "" ||
      !Number.isFinite(payload.price) ||
      payload.price < 0.01 ||
      form.stock.trim() === "" ||
      !Number.isInteger(payload.stock) ||
      payload.stock < 0
    ) {
      setError(
        "Enter valid details. Price must be at least ₹0.01 and stock must be a whole number of zero or more."
      );
      return;
    }

    setSaving(true);
    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API_URL}/books/${editingId}`
      : `${API_URL}/books`;

    try {
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || `Unable to ${isEditing ? "update" : "add"} book.`
        );
      }

      setMessage(
        isEditing ? "Book updated successfully." : "Book added successfully."
      );
      resetForm();
      await loadBooks(1, search);
    } catch (err) {
      setError(err.message || "Unable to save the book.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(book) {
    setEditingId(book._id);
    setForm({
      title: book.title ?? "",
      author: book.author ?? "",
      price: String(book.price ?? ""),
      category: book.category ?? "",
      stock: String(book.stock ?? 0),
    });

    setMessage("");
    setError("");

    document
      .getElementById("book-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    titleInputRef.current?.focus();
  }

  // Update stock.
  async function updateStock(book) {
    const value = window.prompt(
      `Enter the new stock quantity for "${book.title}":`,
      String(book.stock)
    );

    if (value === null) return;

    if (
      value.trim() === "" ||
      !Number.isInteger(Number(value)) ||
      Number(value) < 0
    ) {
      setError("Stock must be a non-negative whole number.");
      setMessage("");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/books/${book._id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Number(value) }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not update stock.");
      }

      setMessage("Stock updated successfully.");
      await loadBooks(pagination.page, search);
    } catch (err) {
      setError(err.message || "Could not update stock.");
    }
  }

  // Disable a book without deleting it.
  async function disableBook(book) {
    if (!window.confirm(`Disable "${book.title}"?`)) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/books/${book._id}/disable`,
        { method: "PATCH" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not disable book.");
      }

      setMessage("Book disabled successfully.");
      setSelectedBook(null);
      await loadBooks(pagination.page, search);
    } catch (err) {
      setError(err.message || "Could not disable book.");
    }
  }

  // BK-12: Load individual book details.
  async function viewBookDetails(book) {
    setSelectedBook(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const response = await fetch(`${API_URL}/books/${book._id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load book details.");
      }

      const details = data.book ?? data;

      setSelectedBook({
        ...details,
        stock: details.stock ?? details.stock_quantity ?? 0,
        active: details.active ?? details.is_active ?? true,
      });
    } catch (err) {
      setDetailError(err.message || "Could not load book details.");
    } finally {
      setDetailLoading(false);
    }
  }

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 0;

  function handleLogin(result, email) {
    if (typeof result?.token !== "string" || !result.token) {
      throw new Error("The bookstore API did not return a login token.");
    }
    window.sessionStorage.setItem(TOKEN_KEY, result.token);
    window.sessionStorage.setItem(AUTH_EMAIL_KEY, email);
    window.sessionStorage.setItem(AUTH_ROLE_KEY, result.role || "");
    setAuthUser({ email, role: result.role || "" });
    setAuthDialogMode(null);
  }

  const isCustomer = authUser?.role === "CUSTOMER";

  // Cart is for logged-in customers (FR-006). Feedback is shown on the book's own card.
  async function addToCart(book) {
    if (!authUser) {
      setCartFeedback({ bookId: book._id, text: "Sign in to add books to your cart.", isError: true });
      setAuthDialogMode("login");
      return;
    }
    if (!isCustomer) {
      setCartFeedback({ bookId: book._id, text: "Only customer accounts can use the cart.", isError: true });
      return;
    }
    try {
      await shopApi.addItem(book._id, 1);
      setCartFeedback({ bookId: book._id, text: "Added to your cart.", isError: false });
    } catch (err) {
      if (err.status === 401) {
        handleLogout();
        setAuthDialogMode("login");
      }
      setCartFeedback({ bookId: book._id, text: describeError(err), isError: true });
    }
  }

  // Cart and orders need a login; send guests to the sign-in dialog instead.
  function openShopView(next) {
    if (!authUser) {
      setAuthDialogMode("login");
      return;
    }
    setView(next);
    window.scrollTo?.({ top: 0 });
  }

  function handleLogout() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_EMAIL_KEY);
    window.sessionStorage.removeItem(AUTH_ROLE_KEY);
    setAuthUser(null);
    setView("catalog");
    setPlaced(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">B</span>
          <span>BookNest</span>
        </a>

        <div className="topbar-actions">
          <span className="admin-label">BOOKSTORE MANAGEMENT</span>
          {isCustomer && (
            <nav className="shop-nav" aria-label="Shopping">
              <button
                type="button"
                className="auth-nav-button"
                aria-current={view === "catalog" ? "page" : undefined}
                onClick={() => setView("catalog")}
              >
                Catalog
              </button>
              <button
                type="button"
                className="auth-nav-button"
                aria-current={view === "cart" || view === "checkout" ? "page" : undefined}
                onClick={() => openShopView("cart")}
              >
                Cart
              </button>
              <button
                type="button"
                className="auth-nav-button"
                aria-current={view === "orders" ? "page" : undefined}
                onClick={() => openShopView("orders")}
              >
                My orders
              </button>
            </nav>
          )}
          {authUser ? (
            <>
              <span className="signed-in-label" title={authUser.role}>
                {authUser.email || "Signed in"}
              </span>
              <button className="auth-nav-button" type="button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                className="auth-nav-button"
                type="button"
                onClick={() => setAuthDialogMode("login")}
              >
                Sign in
              </button>
              <button
                className="auth-nav-button auth-nav-primary"
                type="button"
                onClick={() => setAuthDialogMode("register")}
              >
                Create account
              </button>
            </>
          )}
        </div>
      </header>

      {authDialogMode && (
        <AuthDialog
          initialMode={authDialogMode}
          onClose={() => setAuthDialogMode(null)}
          onLogin={handleLogin}
        />
      )}

      {view === "cart" && (
        <main className="container">
          <CartPage
            api={shopApi}
            onCheckout={() => setView("checkout")}
            onContinueShopping={() => setView("catalog")}
            onLogin={() => setAuthDialogMode("login")}
          />
        </main>
      )}

      {view === "checkout" && (
        <main className="container">
          <CheckoutPage
            api={shopApi}
            onBack={() => setView("cart")}
            onLogin={() => setAuthDialogMode("login")}
            onPlaced={(order, address) => {
              setPlaced({ order, address });
              setView("confirmation");
              window.scrollTo?.({ top: 0 });
            }}
          />
        </main>
      )}

      {view === "confirmation" && (
        <main className="container">
          <OrderConfirmation
            order={placed?.order}
            address={placed?.address}
            onViewOrders={() => setView("orders")}
            onContinueShopping={() => setView("catalog")}
          />
        </main>
      )}

      {view === "orders" && (
        <main className="container">
          <OrdersPage
            api={shopApi}
            onContinueShopping={() => setView("catalog")}
            onLogin={() => setAuthDialogMode("login")}
          />
        </main>
      )}

      {view === "catalog" && (
      <main className="container" id="home">
        {/* BK-13: Catalog home section */}
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR DIGITAL BOOKSTORE</p>
            <h1>Every book opens a new world.</h1>
            <p className="hero-description">
              Discover books, explore their details, and find your next read.
              Manage your collection and inventory in one place.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                document
                  .getElementById("catalog")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore the catalog
            </button>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <span>BOOKS</span>
            <span>IDEAS</span>
            <span>WORLDS</span>
          </div>
        </section>

        <section className="stats">
          <article className="stat-card">
            <span>Active titles</span>
            <strong>
              {loading ? "…" : pagination.totalBooks.toLocaleString("en-IN")}
            </strong>
          </article>
          <article className="stat-card">
            <span>Total stock</span>
            <strong>
              {loading ? "…" : pagination.totalStock.toLocaleString("en-IN")}
            </strong>
          </article>
          <article className="stat-card">
            <span>Catalog pages</span>
            <strong>{loading ? "…" : totalPages}</strong>
          </article>
        </section>

        <section className="management-grid">
          {/* Add/edit book form */}
          <section className="panel form-panel" id="book-form">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CATALOG MANAGEMENT</p>
                <h2>{editingId ? "Edit book" : "Add a new book"}</h2>
              </div>
              <button
                className="heading-icon"
                type="button"
                aria-label="Add a new book"
                title="Start adding a book"
                onClick={handleAddButton}
                disabled={saving}
              >
                +
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="title">Book title</label>
              <input
                ref={titleInputRef}
                id="title"
                name="title"
                placeholder="e.g. Atomic Habits"
                value={form.title}
                onChange={handleChange}
                required
              />

              <label htmlFor="author">Author</label>
              <input
                id="author"
                name="author"
                placeholder="Author's name"
                value={form.author}
                onChange={handleChange}
                required
              />

              <div className="input-row">
                <div>
                  <label htmlFor="price">Price (₹)</label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="399"
                    value={form.price}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="stock">Stock</label>
                  <input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="10"
                    value={form.stock}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <label htmlFor="category">Category</label>
              <input
                id="category"
                name="category"
                placeholder="e.g. Self Help"
                value={form.category}
                onChange={handleChange}
                required
              />

              <button className="primary-button" type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update book"
                    : "Add book to catalog"}
              </button>

              {editingId && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel editing
                </button>
              )}
            </form>
          </section>

          {/* BK-12: Book details */}
          {(detailLoading || detailError || selectedBook) && (
            <section className="panel book-detail-panel">
              {detailLoading && <p>Loading book details...</p>}

              {detailError && (
                <p className="notice error-notice" role="alert">
                  {detailError}
                </p>
              )}

              {selectedBook && (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">BOOK INFORMATION</p>
                      <h2>{selectedBook.title}</h2>
                    </div>
                    <button
                      className="refresh-button"
                      type="button"
                      onClick={() => {
                        setSelectedBook(null);
                        setDetailError("");
                      }}
                    >
                      Back to catalog
                    </button>
                  </div>

                  {selectedBook.cover_image && (
                    <img
                      src={selectedBook.cover_image}
                      alt={`Cover of ${selectedBook.title}`}
                      style={{
                        width: "140px",
                        maxHeight: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        marginBottom: "16px",
                      }}
                    />
                  )}

                  <div className="book-detail-content">
                    <p><strong>Author:</strong> {selectedBook.author}</p>
                    <p><strong>Category:</strong> {selectedBook.category}</p>
                    <p>
                      <strong>Price:</strong>{" "}
                      ₹{Number(selectedBook.price).toFixed(2)}
                    </p>
                    <p><strong>Stock:</strong> {selectedBook.stock}</p>
                    <p>
                      <strong>Availability:</strong>{" "}
                      {Number(selectedBook.stock) <= 0
                        ? "Out of stock"
                        : "In stock"}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {selectedBook.active ? "Active" : "Disabled"}
                    </p>
                    <p>
                      <strong>Description:</strong>{" "}
                      {selectedBook.description || "No description available."}
                    </p>
                  </div>
                </>
              )}
            </section>
          )}

          {/* BK-13: Catalog, search results, and book cards */}
          <section className="panel catalog-panel" id="catalog">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR COLLECTION</p>
                <h2>Book catalog</h2>
              </div>
              <button
                className="refresh-button"
                type="button"
                onClick={() => loadBooks(currentPage, search)}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <input
              className="search-input"
              type="search"
              placeholder="Search title, author, or category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search books by title, author, or category"
            />

            {error && (
              <p className="notice error-notice" role="alert">{error}</p>
            )}
            {message && (
              <p className="notice success-notice" role="status">{message}</p>
            )}

            {loading ? (
              <p className="empty-state">Loading books...</p>
            ) : refreshing ? (
              <p className="empty-state">Loading matching books...</p>
            ) : books.length === 0 ? (
              <p className="empty-state">
                {search.trim()
                  ? "No matching books found. Try another title, author, or category."
                  : "No books found on this page."}
              </p>
            ) : (
              <div className="book-list">
                {books.map((book) => {
                  const outOfStock = Number(book.stock) <= 0;

                  return (
                    <article className="book-card" key={book._id}>
                      <div className="book-cover" aria-hidden="true">
                        {book.title.charAt(0).toUpperCase()}
                      </div>

                      <div className="book-details">
                        <div className="book-title-row">
                          <h3>{book.title}</h3>
                          <span
                            className={`status ${
                              book.active
                                ? "status-active"
                                : "status-disabled"
                            }`}
                          >
                            {book.active ? "Active" : "Disabled"}
                          </span>
                        </div>

                        <p className="book-author">by {book.author}</p>
                        <p className="book-category">{book.category}</p>

                        {/* BK-13: Clear stock availability label */}
                        <p
                          className={`stock-availability ${
                            outOfStock ? "out-of-stock" : "in-stock"
                          }`}
                          role="status"
                        >
                          {outOfStock
                            ? "Out of stock"
                            : `In stock · ${book.stock} available`}
                        </p>

                        <div className="book-meta">
                          <strong>₹{Number(book.price).toFixed(2)}</strong>
                          <span>Stock: {book.stock}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => viewBookDetails(book)}
                        >
                          View Details
                        </button>

                        {/* FR-006: only in-stock, active books can be added */}
                        {book.active && !outOfStock && (
                          <button
                            type="button"
                            className="add-to-cart"
                            onClick={() => addToCart(book)}
                          >
                            Add to cart
                          </button>
                        )}
                        {cartFeedback?.bookId === book._id && (
                          <p
                            className={`cart-feedback${cartFeedback.isError ? " cart-feedback--error" : ""}`}
                            role={cartFeedback.isError ? "alert" : "status"}
                          >
                            {cartFeedback.text}
                            {!cartFeedback.isError && (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  className="cart-feedback__link"
                                  onClick={() => openShopView("cart")}
                                >
                                  View cart
                                </button>
                              </>
                            )}
                          </p>
                        )}

                        {book.active && (
                          <div className="book-actions">
                            <button
                              type="button"
                              onClick={() => startEditing(book)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStock(book)}
                            >
                              Update stock
                            </button>
                            <button
                              type="button"
                              className="disable-action"
                              onClick={() => disableBook(book)}
                            >
                              Disable
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* BK-10: Pagination */}
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  className="refresh-button"
                  type="button"
                  disabled={refreshing || currentPage <= 1}
                  onClick={() => loadBooks(currentPage - 1, search)}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                  {" · "}
                  {pagination.totalBooks.toLocaleString("en-IN")} books
                </span>
                <button
                  className="refresh-button"
                  type="button"
                  disabled={refreshing || currentPage >= totalPages}
                  onClick={() => loadBooks(currentPage + 1, search)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </section>

        <section className="database-note">
          <span className="database-dot" />
          <p>
            <strong>Database-backed catalog</strong>
            <span>
              {" "}
              Books are loaded from your Express API and MongoDB database.
            </span>
          </p>
        </section>
      </main>
      )}

      <footer className="footer">
        Online Bookstore · Software Engineering Mini-Project
      </footer>
    </div>
  );
}

export default App;
