require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// 1. Define the Book model
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number.",
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookSchema);

// 2. Home route
app.get("/", (req, res) => {
  res.json({ message: "Online Bookstore API is running!" });
});

// 3. Health-check route
app.get("/api/health", (req, res) => {
  res.json({
    status: mongoose.connection.readyState === 1 ? "OK" : "Disconnected",
    application: "Online Bookstore",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

// 4. Get all books
app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error.message);
    res.status(500).json({ message: "Failed to fetch books." });
  }
});

// 5. Add a new book
app.post("/api/books", async (req, res) => {
  try {
    const { title, author, price, category, stock } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof author !== "string" ||
      !author.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return res.status(400).json({
        message:
          "Enter a valid title, author, category, positive price, and non-negative whole-number stock.",
      });
    }

    const book = await Book.create({
      title,
      author,
      price,
      category,
      stock,
    });

    res.status(201).json({
      message: "Book added successfully",
      book,
    });
  } catch (error) {
    console.error("Error adding book:", error.message);
    res.status(500).json({ message: "Failed to add book." });
  }
});

// 6. Edit book details
app.put("/api/books/:id", async (req, res) => {
  try {
    const { title, author, price, category } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof author !== "string" ||
      !author.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return res.status(400).json({
        message: "Enter a valid title, author, category, and positive price.",
      });
    }

    const book = await Book.findByIdAndUpdate(
      req.params.id,
      {
        title: title.trim(),
        author: author.trim(),
        price,
        category: category.trim(),
      },
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    res.json({ message: "Book updated successfully", book });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid book ID." });
    }

    console.error("Error updating book:", error.message);
    res.status(500).json({ message: "Failed to update book." });
  }
});

// 7. Update stock
app.patch("/api/books/:id/stock", async (req, res) => {
  try {
    const { stock } = req.body;

    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({
        message: "Stock must be a non-negative whole number.",
      });
    }

    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    res.json({ message: "Stock updated successfully", book });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid book ID." });
    }

    console.error("Error updating stock:", error.message);
    res.status(500).json({ message: "Failed to update stock." });
  }
});

// 8. Disable a book without deleting it
app.patch("/api/books/:id/disable", async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    res.json({ message: "Book disabled successfully", book });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid book ID." });
    }

    console.error("Error disabling book:", error.message);
    res.status(500).json({ message: "Failed to disable book." });
  }
});

// 9. Connect to MongoDB and start the server
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing from the server/.env file.");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(`Online Bookstore API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();