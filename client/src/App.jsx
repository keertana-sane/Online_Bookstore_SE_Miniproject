import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const EMPTY_FORM = {
  title: "",
  author: "",
  price: "",
  category: "",
  stock: "",
};

function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const titleInputRef = useRef(null);

  // Load books from the backend API.
  const loadBooks = useCallback(async () => {
    setRefreshing(true);

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
          "Cannot connect to the bookstore API. Check that the backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Handle changes in form fields.
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Reset the form.
  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  }

  // Start adding a new book.
  function handleAddButton() {
    resetForm();
    setError("");
    setMessage("");

    document
      .getElementById("book-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    titleInputRef.current?.focus();
  }

  // Add a new book or update an existing book.
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

      setMessage(
        isEditing
          ? "Book updated successfully."
          : "Book added successfully."
      );

      resetForm();

      await loadBooks();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save the book. Check that the backend and MongoDB are running."
      );
    } finally {
      setSaving(false);
    }
  }

  // Load a book into the form for editing.
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

  // Update the stock quantity of a book.
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

  // Disable a book without deleting it from the database.
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

  // Search books by title, author, or category.
  const filteredBooks = books.filter((book) => {
    const text =
      `${book.title} ${book.author} ${book.category}`.toLowerCase();

    return text.includes(search.toLowerCase().trim());
  });

  // Calculate dashboard statistics.
  const activeBooks = books.filter((book) => book.active);

  const totalStock = activeBooks.reduce(
    (sum, book) => sum + Number(book.stock || 0),
    0
  );

  return (
    <div className="app">
      {/* Top navigation */}
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">B</span>
          <span>BookNest</span>
        </a>

        <span className="admin-label">BOOKSTORE MANAGEMENT</span>
      </header>

      <main className="container" id="home">
        {/* Hero section */}
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR DIGITAL BOOKSTORE</p>

            <h1>Every book opens a new world.</h1>

            <p className="hero-description">
              Manage your collection, update inventory, and keep your
              catalog organized in one place.
            </p>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <span>BOOKS</span>
            <span>IDEAS</span>
            <span>WORLDS</span>
          </div>
        </section>

        {/* Dashboard statistics */}
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

        {/* Book management and catalog */}
        <section className="management-grid">
          {/* Add and edit book form */}
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

          {/* Book catalog */}
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
              aria-label="Search books"
            />

            {/* Success and error messages */}
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

            {/* Loading and empty states */}
            {loading ? (
              <p className="empty-state">Loading books...</p>
            ) : filteredBooks.length === 0 ? (
              <p className="empty-state">
                {search.trim()
                  ? "No matching books found."
                  : "No books yet. Add your first book using the form."}
              </p>
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

                      <div className="book-meta">
                        <strong>
                          ₹{Number(book.price).toFixed(2)}
                        </strong>

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

        {/* Database connection information */}
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