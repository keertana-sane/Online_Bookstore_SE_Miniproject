
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Define the Book model using this server's Mongoose connection.
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock_quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    cover_image: {
      type: String,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    seedBatch: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Book =
  mongoose.models.Book || mongoose.model("Book", bookSchema);

app.use(cors());
app.use(express.json());

// 1. Home route
app.get("/", (req, res) => {
  res.json({
    message: "Online Bookstore API is running!",
  });
});

// 2. Health-check route
app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    status: connected ? "OK" : "Disconnected",
    application: "Online Bookstore",
    database: connected ? "Connected" : "Disconnected",
  });
});

// 3. Browse books with pagination (BK-10)
app.get("/api/books", async (req, res) => {
  try {
    const parsePositiveInteger = (value) => {
      if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
      ) {
        return null;
      }

      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };

    const page =
      req.query.page === undefined
        ? 1
        : parsePositiveInteger(req.query.page);

    const requestedLimit =
      req.query.limit === undefined
        ? 20
        : parsePositiveInteger(req.query.limit);

    if (page === null || requestedLimit === null) {
      return res.status(400).json({
        message: "Page and limit must be positive integers.",
      });
    }

    const limit = Math.min(requestedLimit, 50);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        message: "Requested page is too large.",
      });
    }

    // Only active books appear in the catalog and inventory total.
    const filter = { is_active: true };

    const [books, totalBooks, stockResult] = await Promise.all([
      Book.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Book.countDocuments(filter),

      Book.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalStock: { $sum: "$stock_quantity" },
          },
        },
      ]),
    ]);

    const totalStock = stockResult[0]?.totalStock ?? 0;

    return res.json({
      books: books.map((book) => ({
        ...book,
        stock: book.stock_quantity,
        active: book.is_active,
      })),
      pagination: {
        page,
        limit,
        totalBooks,
        totalPages: Math.ceil(totalBooks / limit),
        totalStock,
      },
    });
  } catch (error) {
    console.error("Error fetching books:", error);

    return res.status(500).json({
      message: "Failed to fetch books.",
    });
  }
});

// 4. Add a new book
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
      price < 0.01 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return res.status(400).json({
        message:
          "Enter a valid title, author, category, price of at least 0.01, and non-negative whole-number stock.",
      });
    }

    const book = await Book.create({
      title: title.trim(),
      author: author.trim(),
      price,
      category: category.trim(),
      stock_quantity: stock,
      is_active: true,
    });

    return res.status(201).json({
      message: "Book added successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    console.error("Error adding book:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Book data failed validation.",
      });
    }

    return res.status(500).json({
      message: "Failed to add book.",
    });
  }
});

// 5. Edit book details
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
      price < 0.01
    ) {
      return res.status(400).json({
        message:
          "Enter a valid title, author, category, and price of at least 0.01.",
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
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found.",
      });
    }

    return res.json({
      message: "Book updated successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    if (
      error.name === "CastError" ||
      error.name === "BSONError" ||
      error.name === "TypeError"
    ) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
    }

    console.error("Error updating book:", error);

    return res.status(500).json({
      message: "Failed to update book.",
    });
  }
});

// 6. Update stock
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
      { stock_quantity: stock },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found.",
      });
    }

    return res.json({
      message: "Stock updated successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    if (
      error.name === "CastError" ||
      error.name === "BSONError" ||
      error.name === "TypeError"
    ) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
    }

    console.error("Error updating stock:", error);

    return res.status(500).json({
      message: "Failed to update stock.",
    });
  }
});

// 7. Disable a book without deleting it
app.patch("/api/books/:id/disable", async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found.",
      });
    }

    return res.json({
      message: "Book disabled successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    if (
      error.name === "CastError" ||
      error.name === "BSONError" ||
      error.name === "TypeError"
    ) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
    }

    console.error("Error disabling book:", error);

    return res.status(500).json({
      message: "Failed to disable book.",
    });
  }
});

// 8. Connect to MongoDB and start the server
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI is missing. Configure it in server/.env."
      );
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB connected successfully.");
    console.log("Database:", mongoose.connection.name);

    app.listen(PORT, () => {
      console.log(
        `Online Bookstore API running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
