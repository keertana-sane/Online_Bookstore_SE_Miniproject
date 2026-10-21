import { useCallback, useEffect, useState } from "react";
import "./App.css";
import AuthDialog from "./components/AuthDialog.jsx";
import { TOKEN_KEY } from "./api/authApi.js";

const API_URL = "http://localhost:5000/api";
const AUTH_EMAIL_KEY = "userEmail";
const AUTH_ROLE_KEY = "userRole";

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
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const emptyForm = {
    title: "",
    author: "",
    price: "",
    category: "",
    stock: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const loadBooks = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(`${API_URL}/books`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load books.");
      }

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response from the bookstore API.");
      }

      setBooks(data);
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the bookstore API. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

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
      payload.price <= 0 ||
      form.stock.trim() === "" ||
      !Number.isInteger(payload.stock) ||
      payload.stock < 0
    ) {
      setError(
        "Enter valid details. Price must be positive and stock must be a whole number of zero or more."
      );
      return;
    }

    setSaving(true);

    try {
      const isEditing = editingId !== null;

      const url = isEditing
        ? `${API_URL}/books/${editingId}`
        : `${API_URL}/books`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          `The server returned an unexpected response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            `Unable to ${isEditing ? "update" : "add"} book (HTTP ${response.status}).`
        );
      }

      // Reload the catalog before clearing the form.
      const refreshResponse = await fetch(`${API_URL}/books`);

      if (!refreshResponse.ok) {
        throw new Error(
          "The save request succeeded, but the catalog could not refresh. Click Refresh to check the saved data."
        );
      }

      const refreshedBooks = await refreshResponse.json();

      if (!Array.isArray(refreshedBooks)) {
        throw new Error(
          "The save request succeeded, but the server returned an invalid book list."
        );
      }

      setBooks(refreshedBooks);
      setMessage(
        isEditing
          ? "Book updated successfully in the database."
          : "Book added successfully to the database."
      );

      resetForm();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save book. Check that the backend and MongoDB are running."
      );
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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

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
      const response = await fetch(
        `${API_URL}/books/${book._id}/stock`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stock: Number(value),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not update stock.");
      }

      setMessage("Stock updated successfully.");
      await loadBooks();
    } catch (err) {
      setError(err.message || "Could not update stock.");
    }
  }

  async function disableBook(book) {
    if (!window.confirm(`Disable "${book.title}"?`)) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/books/${book._id}/disable`,
        {
          method: "PATCH",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not disable book.");
      }

      setMessage("Book disabled successfully.");
      await loadBooks();
    } catch (err) {
      setError(err.message || "Could not disable book.");
    }
  }

  const filteredBooks = books.filter((book) => {
    const text =
      `${book.title} ${book.author} ${book.category}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  const activeBooks = books.filter((book) => book.active);
  const totalStock = activeBooks.reduce(
    (sum, book) => sum + Number(book.stock || 0),
    0
  );

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

  function handleLogout() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_EMAIL_KEY);
    window.sessionStorage.removeItem(AUTH_ROLE_KEY);
    setAuthUser(null);
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

      <main className="container" id="home">
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR DIGITAL BOOKSTORE</p>
            <h1>Every book opens a new world.</h1>
            <p className="hero-description">
              Manage your collection, update inventory, and keep your catalog
              organized in one place.
            </p>
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
            <strong>{activeBooks.length}</strong>
          </article>

          <article className="stat-card">
            <span>Total stock</span>
            <strong>{totalStock}</strong>
          </article>

          <article className="stat-card">
            <span>All records</span>
            <strong>{books.length}</strong>
          </article>
        </section>

        <section className="management-grid">
          <section className="panel form-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CATALOG MANAGEMENT</p>
                <h2>{editingId ? "Edit book" : "Add a new book"}</h2>
              </div>

              <span className="heading-icon">+</span>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="title">Book title</label>
              <input
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

              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
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

          <section className="panel catalog-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR COLLECTION</p>
                <h2>Book catalog</h2>
              </div>

              <button
                className="refresh-button"
                type="button"
                onClick={loadBooks}
              >
                Refresh
              </button>
            </div>

            <input
              className="search-input"
              type="search"
              placeholder="Search title, author, or category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search books"
            />

            {error && (
              <p className="notice error-notice" role="alert">
                {error}
              </p>
            )}

            {message && (
              <p className="notice success-notice" role="status">
                {message}
              </p>
            )}

            {loading ? (
              <p className="empty-state">Loading books...</p>
            ) : filteredBooks.length === 0 ? (
              <p className="empty-state">No matching books found.</p>
            ) : (
              <div className="book-list">
                {filteredBooks.map((book) => (
                  <article className="book-card" key={book._id}>
                    <div className="book-cover" aria-hidden="true">
                      {book.title.charAt(0).toUpperCase()}
                    </div>

                    <div className="book-details">
                      <div className="book-title-row">
                        <h3>{book.title}</h3>

                        <span
                          className={`status ${
                            book.active ? "status-active" : "status-disabled"
                          }`}
                        >
                          {book.active ? "Active" : "Disabled"}
                        </span>
                      </div>

                      <p className="book-author">by {book.author}</p>
                      <p className="book-category">{book.category}</p>

                      <div className="book-meta">
                        <strong>₹{Number(book.price).toFixed(2)}</strong>
                        <span>Stock: {book.stock}</span>
                      </div>

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
                ))}
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

      <footer className="footer">
        Online Bookstore · Software Engineering Mini-Project
      </footer>
    </div>
  );
}

export default App;